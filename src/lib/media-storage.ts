import path from "path";
import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import sharp from "sharp";
import {
  copy as blobCopy,
  del as blobDelete,
  get as blobGet,
  head as blobHead,
  put as blobPut,
} from "@vercel/blob";
import {
  type BlobMediaKind,
  contentTypeForExt,
  isLocalTextPreviewDocument,
} from "@/lib/media-types";

type StorageBackend = "local" | "blob";
export type MediaSize = "original" | "sm" | "lg";
export type StoredMediaResult = {
  baseName: string;
  ext: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeOriginal: number;
  sizeSm: number;
  sizeLg: number;
  previewStatus: "pending" | "started" | "complete" | "error";
};

const DATA_DIR = path.join(process.cwd(), "data");
function resolveStorageBackend(): StorageBackend {
  const raw = process.env.STORAGE_BACKEND;
  if (raw === "blob" || raw === "local") {
    return raw;
  }
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}
const STORAGE_BACKEND = resolveStorageBackend();
const BLOB_ACCESS = "private";

async function readWebStreamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      if (result.value) {
        chunks.push(Buffer.from(result.value));
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function datePathParts(uploadedAt: Date): {
  year: string;
  month: string;
  day: string;
} {
  return {
    year: String(uploadedAt.getUTCFullYear()),
    month: String(uploadedAt.getUTCMonth() + 1).padStart(2, "0"),
    day: String(uploadedAt.getUTCDate()).padStart(2, "0"),
  };
}

function buildStorageKey(
  kind: string,
  baseName: string,
  ext: string,
  size: MediaSize,
  uploadedAt: Date,
): string {
  const { year, month, day } = datePathParts(uploadedAt);
  return path.posix.join(
    "uploads",
    year,
    month,
    day,
    kind,
    size,
    `${baseName}.${ext}`,
  );
}

function mediaStorageKey(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
}): string {
  const requestedExt =
    input.kind === "image" || input.size === "original" ? input.ext : "png";
  return buildStorageKey(
    input.kind,
    input.baseName,
    requestedExt,
    input.size,
    input.uploadedAt,
  );
}

export function usesS3StorageBackend(): boolean {
  return false;
}

function absolutePathForKey(key: string): string {
  return path.join(DATA_DIR, key);
}

export function buildMediaBaseName(uploadedAt: Date): string {
  const iso = uploadedAt.toISOString().replace(/[:.]/g, "-");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${iso}-${suffix}`;
}

async function writeKey(key: string, ext: string, data: Buffer): Promise<void> {
  if (STORAGE_BACKEND === "blob") {
    await blobPut(key, data, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentTypeForExt(ext),
    });
    return;
  }
  const filePath = absolutePathForKey(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

async function copyKey(
  sourceKey: string,
  targetKey: string,
  ext: string,
): Promise<void> {
  if (sourceKey === targetKey) {
    return;
  }
  if (STORAGE_BACKEND === "blob") {
    await blobCopy(sourceKey, targetKey, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentTypeForExt(ext),
    });
    return;
  }
  const sourcePath = absolutePathForKey(sourceKey);
  const targetPath = absolutePathForKey(targetKey);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function deleteKey(key: string): Promise<void> {
  if (STORAGE_BACKEND === "blob") {
    await blobDelete(key);
    return;
  }
  await fs.rm(absolutePathForKey(key), { force: true });
}

async function readKey(key: string): Promise<Buffer> {
  if (STORAGE_BACKEND === "blob") {
    const response = await blobGet(key, {
      access: BLOB_ACCESS,
      useCache: false,
    });
    if (!response || response.statusCode !== 200 || !response.stream) {
      throw new Error("Blob object was not found.");
    }
    return readWebStreamToBuffer(response.stream);
  }
  return fs.readFile(absolutePathForKey(key));
}

async function getKeySize(key: string): Promise<number> {
  if (STORAGE_BACKEND === "blob") {
    const head = await blobHead(key);
    return Number(head.size ?? 0);
  }
  const stats = await fs.stat(absolutePathForKey(key));
  return Number(stats.size ?? 0);
}

async function readKeyRange(
  key: string,
  start: number,
  end: number,
): Promise<Buffer> {
  if (STORAGE_BACKEND === "blob") {
    const response = await blobGet(key, {
      access: BLOB_ACCESS,
      useCache: false,
      headers: {
        Range: `bytes=${start}-${end}`,
      },
    });
    if (!response || response.statusCode === 304 || !response.stream) {
      throw new Error("Blob range read returned an empty body.");
    }
    return readWebStreamToBuffer(response.stream);
  }
  const length = end - start + 1;
  const handle = await fs.open(absolutePathForKey(key), "r");
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    return buffer;
  } finally {
    await handle.close();
  }
}

async function readKeyStream(key: string): Promise<ReadableStream<Uint8Array>> {
  if (STORAGE_BACKEND === "blob") {
    const response = await blobGet(key, {
      access: BLOB_ACCESS,
      useCache: true,
    });
    if (!response || response.statusCode !== 200 || !response.stream) {
      throw new Error("Blob object was not found.");
    }
    return response.stream;
  }
  return Readable.toWeb(
    createReadStream(absolutePathForKey(key)),
  ) as ReadableStream<Uint8Array>;
}

async function readKeyRangeStream(
  key: string,
  start: number,
  end: number,
): Promise<ReadableStream<Uint8Array>> {
  if (STORAGE_BACKEND === "blob") {
    const response = await blobGet(key, {
      access: BLOB_ACCESS,
      useCache: false,
      headers: {
        Range: `bytes=${start}-${end}`,
      },
    });
    if (!response || response.statusCode === 304 || !response.stream) {
      throw new Error("Blob range stream returned an empty body.");
    }
    return response.stream;
  }
  return Readable.toWeb(
    createReadStream(absolutePathForKey(key), { start, end }),
  ) as ReadableStream<Uint8Array>;
}

function asPreviewPng(_text: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
  <rect width="100%" height="100%" fill="#111827"/>
  <rect x="24" y="24" width="976" height="720" rx="18" fill="#1f2937" stroke="#374151"/>
  <rect x="120" y="180" width="784" height="34" rx="8" fill="#334155"/>
  <rect x="120" y="240" width="680" height="22" rx="8" fill="#475569"/>
  <rect x="120" y="282" width="720" height="22" rx="8" fill="#475569"/>
  <rect x="120" y="324" width="610" height="22" rx="8" fill="#475569"/>
  <rect x="120" y="366" width="540" height="22" rx="8" fill="#475569"/>
  <rect x="120" y="440" width="420" height="18" rx="8" fill="#64748b"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function asTextPreviewPng(label: string, text: string): Promise<Buffer> {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[^\x09\x20-\x7E]/g, " "))
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, 18);
  const paddedLines = lines.length > 0 ? lines : ["(empty file)"];
  const lineNodes = paddedLines
    .map(
      (line, index) =>
        `<text x="56" y="${190 + index * 30}" font-size="24" fill="#d1d5db" font-family="monospace">${escapeXml(line.slice(0, 88))}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <rect x="24" y="24" width="976" height="720" rx="18" fill="#111827" stroke="#1f2937"/>
  <text x="56" y="116" font-size="44" fill="#93c5fd" font-family="Arial, sans-serif">${escapeXml(label)}</text>
  ${lineNodes}
  </svg>`;
  try {
    console.log("Generating text preview PNG with fontconfig.");
    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch {
    // Fall back to a font-free placeholder if fontconfig is unavailable.
    console.warn(
      "Fontconfig is unavailable, falling back to a font-free placeholder.",
    );
    return asPreviewPng("File Preview");
  }
}

async function tryGenerateDocumentPreview(
  buffer: Buffer,
  ext: string,
  mimeType: string,
): Promise<Buffer | null> {
  const normalizedExt = ext.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();

  if (isLocalTextPreviewDocument(normalizedMime, normalizedExt)) {
    return asTextPreviewPng(
      `${normalizedExt.toUpperCase()} preview`,
      buffer.toString("utf8", 0, 256 * 1024),
    );
  }
  return null;
}

export async function storeGenericMediaFromBuffer(input: {
  kind: Exclude<BlobMediaKind, "image">;
  buffer: Buffer;
  ext: string;
  mimeType: string;
  uploadedAt: Date;
  deferPreview?: boolean;
}): Promise<StoredMediaResult> {
  const baseName = buildMediaBaseName(input.uploadedAt);
  const originalKey = buildStorageKey(
    input.kind,
    baseName,
    input.ext,
    "original",
    input.uploadedAt,
  );
  await writeKey(originalKey, input.ext, input.buffer);
  const sizeOriginal = input.buffer.length;

  if (input.deferPreview) {
    return {
      baseName,
      ext: input.ext,
      mimeType: input.mimeType,
      sizeOriginal,
      sizeSm: 0,
      sizeLg: 0,
      previewStatus: "pending",
    };
  }

  let lgBuffer: Buffer;
  if (input.kind === "document") {
    const preview = await tryGenerateDocumentPreview(
      input.buffer,
      input.ext,
      input.mimeType,
    );
    if (!preview) {
      return {
        baseName,
        ext: input.ext,
        mimeType: input.mimeType,
        sizeOriginal,
        sizeSm: 0,
        sizeLg: 0,
        previewStatus: "error",
      };
    }
    lgBuffer = await sharp(preview)
      .resize({ width: 1024, withoutEnlargement: true })
      .png()
      .toBuffer();
  } else {
    lgBuffer = await asPreviewPng("File Preview");
  }
  const smBuffer = await sharp(lgBuffer)
    .resize({ width: 320, withoutEnlargement: true })
    .png()
    .toBuffer();

  const smKey = buildStorageKey(
    input.kind,
    baseName,
    "png",
    "sm",
    input.uploadedAt,
  );
  const lgKey = buildStorageKey(
    input.kind,
    baseName,
    "png",
    "lg",
    input.uploadedAt,
  );
  await writeKey(smKey, "png", smBuffer);
  await writeKey(lgKey, "png", lgBuffer);

  return {
    baseName,
    ext: input.ext,
    mimeType: input.mimeType,
    sizeOriginal,
    sizeSm: smBuffer.length,
    sizeLg: lgBuffer.length,
    previewStatus: "complete",
  };
}

const MAX_INLINE_PREVIEW_BYTES = 512 * 1024 * 1024;

export async function storeGenericMediaFromStoredUpload(input: {
  kind: Exclude<BlobMediaKind, "image">;
  sourceKey: string;
  sizeOriginal: number;
  ext: string;
  mimeType: string;
  uploadedAt: Date;
  deferPreview?: boolean;
}): Promise<StoredMediaResult> {
  const baseName = buildMediaBaseName(input.uploadedAt);
  const originalKey = buildStorageKey(
    input.kind,
    baseName,
    input.ext,
    "original",
    input.uploadedAt,
  );
  await copyKey(input.sourceKey, originalKey, input.ext);
  if (input.sourceKey !== originalKey) {
    await deleteKey(input.sourceKey);
  }

  if (input.deferPreview) {
    return {
      baseName,
      ext: input.ext,
      mimeType: input.mimeType,
      sizeOriginal: input.sizeOriginal,
      sizeSm: 0,
      sizeLg: 0,
      previewStatus: "pending",
    };
  }

  let lgBuffer: Buffer;
  if (input.kind === "document") {
    if (input.sizeOriginal > MAX_INLINE_PREVIEW_BYTES) {
      return {
        baseName,
        ext: input.ext,
        mimeType: input.mimeType,
        sizeOriginal: input.sizeOriginal,
        sizeSm: 0,
        sizeLg: 0,
        previewStatus: "error",
      };
    }
    const sourceBuffer = await readKey(originalKey);
    const preview = await tryGenerateDocumentPreview(
      sourceBuffer,
      input.ext,
      input.mimeType,
    );
    if (!preview) {
      return {
        baseName,
        ext: input.ext,
        mimeType: input.mimeType,
        sizeOriginal: input.sizeOriginal,
        sizeSm: 0,
        sizeLg: 0,
        previewStatus: "error",
      };
    }
    lgBuffer = await sharp(preview)
      .resize({ width: 1024, withoutEnlargement: true })
      .png()
      .toBuffer();
  } else {
    lgBuffer = await asPreviewPng("File Preview");
  }
  const smBuffer = await sharp(lgBuffer)
    .resize({ width: 320, withoutEnlargement: true })
    .png()
    .toBuffer();
  const smKey = buildStorageKey(
    input.kind,
    baseName,
    "png",
    "sm",
    input.uploadedAt,
  );
  const lgKey = buildStorageKey(
    input.kind,
    baseName,
    "png",
    "lg",
    input.uploadedAt,
  );
  await writeKey(smKey, "png", smBuffer);
  await writeKey(lgKey, "png", lgBuffer);

  return {
    baseName,
    ext: input.ext,
    mimeType: input.mimeType,
    sizeOriginal: input.sizeOriginal,
    sizeSm: smBuffer.length,
    sizeLg: lgBuffer.length,
    previewStatus: "complete",
  };
}

export async function storeImageMediaFromBuffer(input: {
  buffer: Buffer;
  ext: string;
  mimeType: string;
  uploadedAt: Date;
}): Promise<StoredMediaResult> {
  const baseName = buildMediaBaseName(input.uploadedAt);
  const ext =
    input.ext.toLowerCase() === "jpeg" ? "jpg" : input.ext.toLowerCase();
  if (ext === "svg") {
    const metadata = await sharp(input.buffer).metadata();
    const originalBuffer = input.buffer;
    // Keep vector data for all sizes to avoid lossy raster conversion.
    const smBuffer = input.buffer;
    const lgBuffer = input.buffer;
    await writeKey(
      buildStorageKey("image", baseName, ext, "original", input.uploadedAt),
      ext,
      originalBuffer,
    );
    await writeKey(
      buildStorageKey("image", baseName, ext, "sm", input.uploadedAt),
      ext,
      smBuffer,
    );
    await writeKey(
      buildStorageKey("image", baseName, ext, "lg", input.uploadedAt),
      ext,
      lgBuffer,
    );
    return {
      baseName,
      ext,
      mimeType: input.mimeType,
      width: metadata.width ?? undefined,
      height: metadata.height ?? undefined,
      sizeOriginal: originalBuffer.length,
      sizeSm: smBuffer.length,
      sizeLg: lgBuffer.length,
      previewStatus: "complete",
    };
  }
  if (ext === "gif") {
    const image = sharp(input.buffer, { animated: true, pages: -1 });
    const metadata = await image.metadata();
    const width = metadata.width ?? undefined;
    const height = metadata.pageHeight ?? metadata.height ?? undefined;
    const originalBuffer = input.buffer;
    const smBuffer = await image
      .clone()
      .resize({ width: 320, withoutEnlargement: true })
      .gif()
      .toBuffer();
    const lgBuffer = await image
      .clone()
      .resize({ width: 1024, withoutEnlargement: true })
      .gif()
      .toBuffer();
    await writeKey(
      buildStorageKey("image", baseName, ext, "original", input.uploadedAt),
      ext,
      originalBuffer,
    );
    await writeKey(
      buildStorageKey("image", baseName, ext, "sm", input.uploadedAt),
      ext,
      smBuffer,
    );
    await writeKey(
      buildStorageKey("image", baseName, ext, "lg", input.uploadedAt),
      ext,
      lgBuffer,
    );
    return {
      baseName,
      ext,
      mimeType: input.mimeType,
      width,
      height,
      sizeOriginal: originalBuffer.length,
      sizeSm: smBuffer.length,
      sizeLg: lgBuffer.length,
      previewStatus: "complete",
    };
  }
  const image = sharp(input.buffer).rotate();
  const metadata = await image.metadata();
  const format: keyof sharp.FormatEnum =
    ext === "jpg" ? "jpeg" : (ext as keyof sharp.FormatEnum);
  const originalBuffer = await image.clone().toFormat(format).toBuffer();
  const smBuffer = await image
    .clone()
    .resize({ width: 320, withoutEnlargement: true })
    .toFormat(format)
    .toBuffer();
  const lgBuffer = await image
    .clone()
    .resize({ width: 1024, withoutEnlargement: true })
    .toFormat(format)
    .toBuffer();

  await writeKey(
    buildStorageKey("image", baseName, ext, "original", input.uploadedAt),
    ext,
    originalBuffer,
  );
  await writeKey(
    buildStorageKey("image", baseName, ext, "sm", input.uploadedAt),
    ext,
    smBuffer,
  );
  await writeKey(
    buildStorageKey("image", baseName, ext, "lg", input.uploadedAt),
    ext,
    lgBuffer,
  );

  return {
    baseName,
    ext,
    mimeType: input.mimeType,
    width: metadata.width ?? undefined,
    height: metadata.height ?? undefined,
    sizeOriginal: originalBuffer.length,
    sizeSm: smBuffer.length,
    sizeLg: lgBuffer.length,
    previewStatus: "complete",
  };
}

export async function storeImageOriginalFromBuffer(input: {
  buffer: Buffer;
  ext: string;
  mimeType: string;
  uploadedAt: Date;
}): Promise<StoredMediaResult> {
  const baseName = buildMediaBaseName(input.uploadedAt);
  const ext =
    input.ext.toLowerCase() === "jpeg" ? "jpg" : input.ext.toLowerCase();
  await writeKey(
    buildStorageKey("image", baseName, ext, "original", input.uploadedAt),
    ext,
    input.buffer,
  );
  let width: number | undefined;
  let height: number | undefined;
  try {
    const metadata = await sharp(input.buffer).metadata();
    width = metadata.width ?? undefined;
    height = metadata.height ?? undefined;
  } catch {
    // The thumbnail service can still try to process formats that sharp cannot read locally.
  }
  return {
    baseName,
    ext,
    mimeType: input.mimeType,
    width,
    height,
    sizeOriginal: input.buffer.length,
    sizeSm: 0,
    sizeLg: 0,
    previewStatus: "pending",
  };
}

export async function storeImageOriginalFromStoredUpload(input: {
  sourceKey: string;
  sizeOriginal: number;
  ext: string;
  mimeType: string;
  uploadedAt: Date;
}): Promise<StoredMediaResult> {
  const baseName = buildMediaBaseName(input.uploadedAt);
  const ext =
    input.ext.toLowerCase() === "jpeg" ? "jpg" : input.ext.toLowerCase();
  const originalKey = buildStorageKey(
    "image",
    baseName,
    ext,
    "original",
    input.uploadedAt,
  );
  await copyKey(input.sourceKey, originalKey, ext);
  if (input.sourceKey !== originalKey) {
    await deleteKey(input.sourceKey);
  }
  let width: number | undefined;
  let height: number | undefined;
  if (input.sizeOriginal <= 512 * 1024 * 1024) {
    try {
      const sourceBuffer = await readKey(originalKey);
      const metadata = await sharp(sourceBuffer).metadata();
      width = metadata.width ?? undefined;
      height = metadata.height ?? undefined;
    } catch {
      // The original is stored; defer thumbnail parsing to the worker.
    }
  }
  return {
    baseName,
    ext,
    mimeType: input.mimeType,
    width,
    height,
    sizeOriginal: input.sizeOriginal,
    sizeSm: 0,
    sizeLg: 0,
    previewStatus: "pending",
  };
}

export async function getMediaBuffer(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
}): Promise<Buffer> {
  const key = mediaStorageKey(input);
  return await readKey(key);
}

export async function getMediaBufferSize(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
}): Promise<number> {
  const key = mediaStorageKey(input);
  return getKeySize(key);
}

export async function getMediaBufferRange(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
  start: number;
  end: number;
}): Promise<Buffer> {
  const key = mediaStorageKey(input);
  return readKeyRange(key, input.start, input.end);
}

export async function getMediaStream(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
}): Promise<ReadableStream<Uint8Array>> {
  const key = mediaStorageKey(input);
  return readKeyStream(key);
}

export async function getMediaRangeStream(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
  start: number;
  end: number;
}): Promise<ReadableStream<Uint8Array>> {
  const key = mediaStorageKey(input);
  return readKeyRangeStream(key, input.start, input.end);
}

export async function getMediaSignedUrl(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
  responseContentType?: string;
}): Promise<string> {
  const key = mediaStorageKey(input);
  if (STORAGE_BACKEND === "blob") {
    const blob = await blobGet(key, { access: BLOB_ACCESS, useCache: true });
    if (!blob) {
      throw new Error("Blob object was not found.");
    }
    return blob.blob.url;
  }
  throw new Error(
    "Direct media URLs are not available for local storage backend.",
  );
}

export async function storeGeneratedPreviewForMedia(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  uploadedAt: Date;
  previewImageBuffer: Buffer;
}): Promise<{
  sizeSm: number;
  sizeLg: number;
  width?: number;
  height?: number;
}> {
  const outputExt = input.kind === "image" ? input.ext.toLowerCase() : "png";
  const outputFormat: keyof sharp.FormatEnum =
    outputExt === "jpg" ? "jpeg" : (outputExt as keyof sharp.FormatEnum);
  const lgBuffer = await sharp(input.previewImageBuffer)
    .resize({ width: 1024, withoutEnlargement: true })
    .toFormat(outputFormat)
    .toBuffer();
  const smBuffer = await sharp(lgBuffer)
    .resize({ width: 320, withoutEnlargement: true })
    .toFormat(outputFormat)
    .toBuffer();
  const metadata = await sharp(lgBuffer).metadata();

  const smKey = buildStorageKey(
    input.kind,
    input.baseName,
    outputExt,
    "sm",
    input.uploadedAt,
  );
  const lgKey = buildStorageKey(
    input.kind,
    input.baseName,
    outputExt,
    "lg",
    input.uploadedAt,
  );
  await writeKey(smKey, outputExt, smBuffer);
  await writeKey(lgKey, outputExt, lgBuffer);

  return {
    sizeSm: smBuffer.length,
    sizeLg: lgBuffer.length,
    width: metadata.width ?? undefined,
    height: metadata.height ?? undefined,
  };
}

export async function readCompletedUploadBuffer(
  storageKey: string,
): Promise<Buffer> {
  return readKey(storageKey);
}

export async function deleteCompletedUploadObject(
  storageKey: string,
): Promise<void> {
  await deleteKey(storageKey);
}
