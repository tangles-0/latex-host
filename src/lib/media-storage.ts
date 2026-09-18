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
import {
  deletePublicBlob,
  getPublicBlob,
  headPublicBlob,
  putPublicBlob,
} from "@/lib/public-blob";

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

const DATA_DIR = path.resolve(
  process.env.LATEX_DATA_DIR?.trim() || path.join(process.cwd(), "data"),
);
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

export function buildMediaOriginalStorageKey(
  kind: BlobMediaKind,
  baseName: string,
  ext: string,
  uploadedAt: Date,
): string {
  return buildStorageKey(kind, baseName, ext, "original", uploadedAt);
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

type StoredObjectRef = {
  key: string;
  publicStore?: boolean;
};

function resolveStoredObject(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
  publicBlobKey?: string | null;
  publicBlobUrl?: string | null;
}): StoredObjectRef {
  if (input.size === "original") {
    const publicUrl = input.publicBlobUrl?.trim();
    const publicKey = input.publicBlobKey?.trim();
    if (publicUrl || publicKey) {
      return { key: publicUrl || publicKey || "", publicStore: true };
    }
  }
  return { key: mediaStorageKey(input) };
}

async function readKey(key: string, publicStore = false): Promise<Buffer> {
  if (publicStore) {
    const response = await getPublicBlob(key, { useCache: false });
    if (!response || response.statusCode !== 200 || !response.stream) {
      throw new Error("Public blob object was not found.");
    }
    return readWebStreamToBuffer(response.stream);
  }
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

async function getKeySize(key: string, publicStore = false): Promise<number> {
  if (publicStore) {
    const head = await headPublicBlob(key);
    return Number(head.size ?? 0);
  }
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
  publicStore = false,
): Promise<Buffer> {
  if (publicStore) {
    const response = await getPublicBlob(key, {
      useCache: false,
      headers: {
        Range: `bytes=${start}-${end}`,
      },
    });
    if (!response || response.statusCode === 304 || !response.stream) {
      throw new Error("Public blob range read returned an empty body.");
    }
    return readWebStreamToBuffer(response.stream);
  }
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

async function readKeyStream(
  key: string,
  publicStore = false,
): Promise<ReadableStream<Uint8Array>> {
  if (publicStore) {
    const response = await getPublicBlob(key, { useCache: true });
    if (!response || response.statusCode !== 200 || !response.stream) {
      throw new Error("Public blob object was not found.");
    }
    return response.stream;
  }
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
  publicStore = false,
): Promise<ReadableStream<Uint8Array>> {
  if (publicStore) {
    const response = await getPublicBlob(key, {
      useCache: false,
      headers: {
        Range: `bytes=${start}-${end}`,
      },
    });
    if (!response || response.statusCode === 304 || !response.stream) {
      throw new Error("Public blob range stream returned an empty body.");
    }
    return response.stream;
  }
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

const LOCAL_MONO_FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
];

async function resolveEmbeddedMonoFont(): Promise<string | null> {
  for (const candidate of LOCAL_MONO_FONT_CANDIDATES) {
    try {
      const buffer = await fs.readFile(candidate);
      return `data:font/ttf;base64,${buffer.toString("base64")}`;
    } catch {
      // try next
    }
  }
  return null;
}

async function asTextPreviewPng(label: string, text: string): Promise<Buffer> {
  // Prefer the offload worker for text/code previews; this path is a fallback.
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[^\x09\x20-\x7E]/g, " "))
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, 18);
  const paddedLines = lines.length > 0 ? lines : ["(empty file)"];
  const fontDataUri = await resolveEmbeddedMonoFont();
  const fontFamily = fontDataUri
    ? "PreviewMono"
    : "DejaVu Sans Mono, Liberation Mono, monospace";
  const fontFace = fontDataUri
    ? `@font-face { font-family: 'PreviewMono'; src: url('${fontDataUri}'); }`
    : "";
  const lineNodes = paddedLines
    .map(
      (line, index) =>
        `<text x="56" y="${190 + index * 30}" font-size="24" fill="#d1d5db" font-family="${fontFamily}">${escapeXml(line.slice(0, 88))}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
  <defs><style><![CDATA[${fontFace}]]></style></defs>
  <rect width="100%" height="100%" fill="#0f172a"/>
  <rect x="24" y="24" width="976" height="720" rx="18" fill="#111827" stroke="#1f2937"/>
  <text x="56" y="116" font-size="44" fill="#93c5fd" font-family="${fontFamily}">${escapeXml(label)}</text>
  ${lineNodes}
  </svg>`;
  try {
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
  if (ext === "gif" || ext === "webp") {
    const image = sharp(input.buffer, { animated: true, pages: -1 });
    const metadata = await image.metadata();
    const isAnimated = ext === "gif" || (metadata.pages ?? 1) > 1;
    if (isAnimated) {
      const width = metadata.width ?? undefined;
      const height = metadata.pageHeight ?? metadata.height ?? undefined;
      const originalBuffer = input.buffer;
      const encodeAnimated = (pipeline: sharp.Sharp) =>
        ext === "gif" ? pipeline.gif() : pipeline.webp();
      const smBuffer = await encodeAnimated(
        image.clone().resize({ width: 320, withoutEnlargement: true }),
      ).toBuffer();
      const lgBuffer = await encodeAnimated(
        image.clone().resize({ width: 1024, withoutEnlargement: true }),
      ).toBuffer();
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

export async function overwriteTextDocumentContent(input: {
  baseName: string;
  ext: string;
  mimeType: string;
  uploadedAt: Date;
  content: string;
  publicBlobKey?: string | null;
}): Promise<{
  sizeOriginal: number;
  sizeSm: number;
  sizeLg: number;
  previewStatus: "complete" | "error";
}> {
  const buffer = Buffer.from(input.content, "utf8");
  const originalKey =
    input.publicBlobKey?.trim() ||
    buildStorageKey(
      "document",
      input.baseName,
      input.ext,
      "original",
      input.uploadedAt,
    );
  if (input.publicBlobKey?.trim()) {
    await putPublicBlob(originalKey, buffer, {
      contentType: input.mimeType || contentTypeForExt(input.ext),
    });
  } else {
    await writeKey(originalKey, input.ext, buffer);
  }

  const preview = await tryGenerateDocumentPreview(
    buffer,
    input.ext,
    input.mimeType,
  );
  if (!preview) {
    return {
      sizeOriginal: buffer.length,
      sizeSm: 0,
      sizeLg: 0,
      previewStatus: "error",
    };
  }

  const lgBuffer = await sharp(preview)
    .resize({ width: 1024, withoutEnlargement: true })
    .png()
    .toBuffer();
  const smBuffer = await sharp(lgBuffer)
    .resize({ width: 320, withoutEnlargement: true })
    .png()
    .toBuffer();

  const smKey = buildStorageKey(
    "document",
    input.baseName,
    "png",
    "sm",
    input.uploadedAt,
  );
  const lgKey = buildStorageKey(
    "document",
    input.baseName,
    "png",
    "lg",
    input.uploadedAt,
  );
  await writeKey(smKey, "png", smBuffer);
  await writeKey(lgKey, "png", lgBuffer);

  return {
    sizeOriginal: buffer.length,
    sizeSm: smBuffer.length,
    sizeLg: lgBuffer.length,
    previewStatus: "complete",
  };
}

type MediaLookupInput = {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
  publicBlobKey?: string | null;
  publicBlobUrl?: string | null;
};

export async function getMediaBuffer(input: MediaLookupInput): Promise<Buffer> {
  const stored = resolveStoredObject(input);
  return readKey(stored.key, stored.publicStore);
}

export async function getMediaBufferSize(input: MediaLookupInput): Promise<number> {
  const stored = resolveStoredObject(input);
  return getKeySize(stored.key, stored.publicStore);
}

export async function getMediaBufferRange(
  input: MediaLookupInput & { start: number; end: number },
): Promise<Buffer> {
  const stored = resolveStoredObject(input);
  return readKeyRange(stored.key, input.start, input.end, stored.publicStore);
}

export async function getMediaStream(
  input: MediaLookupInput,
): Promise<ReadableStream<Uint8Array>> {
  const stored = resolveStoredObject(input);
  return readKeyStream(stored.key, stored.publicStore);
}

export async function getMediaRangeStream(
  input: MediaLookupInput & { start: number; end: number },
): Promise<ReadableStream<Uint8Array>> {
  const stored = resolveStoredObject(input);
  return readKeyRangeStream(
    stored.key,
    input.start,
    input.end,
    stored.publicStore,
  );
}

export async function getMediaSignedUrl(
  input: MediaLookupInput & { responseContentType?: string },
): Promise<string> {
  if (input.size === "original" && input.publicBlobUrl?.trim()) {
    return input.publicBlobUrl.trim();
  }
  const stored = resolveStoredObject(input);
  if (stored.publicStore) {
    const blob = await getPublicBlob(stored.key, { useCache: true });
    if (!blob) {
      throw new Error("Public blob object was not found.");
    }
    return blob.blob.url;
  }
  const key = stored.key;
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

export function publicOriginalRedirectUrl(input: {
  size: MediaSize;
  publicBlobUrl?: string | null;
}): string | null {
  if (input.size !== "original") {
    return null;
  }
  const url = input.publicBlobUrl?.trim();
  return url || null;
}

export async function storePublicOriginalFromUpload(input: {
  kind: BlobMediaKind;
  sourceKey: string;
  publicBlobUrl: string;
  sizeOriginal: number;
  ext: string;
  mimeType: string;
  uploadedAt: Date;
  baseName: string;
}): Promise<StoredMediaResult> {
  const expectedKey = buildMediaOriginalStorageKey(
    input.kind,
    input.baseName,
    input.ext,
    input.uploadedAt,
  );
  if (input.sourceKey !== expectedKey) {
    throw new Error("Public upload key does not match the reserved media path.");
  }
  const head = await headPublicBlob(input.sourceKey);
  const sizeOriginal = Number(head.size ?? input.sizeOriginal);
  if (sizeOriginal !== input.sizeOriginal) {
    throw new Error("Uploaded file size does not match the declared file size.");
  }
  return {
    baseName: input.baseName,
    ext: input.ext,
    mimeType: input.mimeType,
    sizeOriginal,
    sizeSm: 0,
    sizeLg: 0,
    previewStatus: "pending",
  };
}

export async function deleteStoredMedia(input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  uploadedAt: Date;
  publicBlobKey?: string | null;
}): Promise<void> {
  if (input.publicBlobKey?.trim()) {
    try {
      await deletePublicBlob(input.publicBlobKey.trim());
    } catch {
      // The original may already be gone from the public store.
    }
  } else {
    try {
      await deleteKey(
        mediaStorageKey({
          kind: input.kind,
          baseName: input.baseName,
          ext: input.ext,
          size: "original",
          uploadedAt: input.uploadedAt,
        }),
      );
    } catch {
      // Ignore missing private originals.
    }
  }
  const previewExt = input.kind === "image" ? input.ext : "png";
  for (const size of ["sm", "lg"] as const) {
    try {
      await deleteKey(
        mediaStorageKey({
          kind: input.kind,
          baseName: input.baseName,
          ext: previewExt,
          size,
          uploadedAt: input.uploadedAt,
        }),
      );
    } catch {
      // Variants are optional until preview generation finishes.
    }
  }
}

const linkOrCopyLocalFile = async (
  sourcePath: string,
  destinationKey: string,
): Promise<void> => {
  if (STORAGE_BACKEND !== "local") {
    throw new Error("Mounted-file imports require local storage.");
  }
  const destinationPath = absolutePathForKey(destinationKey);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  try {
    await fs.link(sourcePath, destinationPath);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (!["EXDEV", "EPERM", "EACCES", "EMLINK"].includes(code)) {
      throw error;
    }
    await fs.copyFile(sourcePath, destinationPath);
  }
};

export async function storeMediaFromLocalFile(input: {
  sourcePath: string;
  kind: BlobMediaKind;
  ext: string;
  mimeType: string;
  sizeOriginal: number;
  uploadedAt: Date;
  deferPreview: boolean;
}): Promise<StoredMediaResult> {
  if (input.kind === "image" && !input.deferPreview) {
    return storeImageMediaFromBuffer({
      buffer: await fs.readFile(input.sourcePath),
      ext: input.ext,
      mimeType: input.mimeType,
      uploadedAt: input.uploadedAt,
    });
  }

  const baseName = buildMediaBaseName(input.uploadedAt);
  const originalKey = buildStorageKey(
    input.kind,
    baseName,
    input.ext,
    "original",
    input.uploadedAt,
  );
  await linkOrCopyLocalFile(input.sourcePath, originalKey);

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

  const lgBuffer = await asPreviewPng("File Preview");
  const smBuffer = await sharp(lgBuffer)
    .resize({ width: 320, withoutEnlargement: true })
    .png()
    .toBuffer();
  await writeKey(
    buildStorageKey(input.kind, baseName, "png", "sm", input.uploadedAt),
    "png",
    smBuffer,
  );
  await writeKey(
    buildStorageKey(input.kind, baseName, "png", "lg", input.uploadedAt),
    "png",
    lgBuffer,
  );
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

export const getMediaLocalPath = (input: {
  kind: BlobMediaKind;
  baseName: string;
  ext: string;
  size: MediaSize;
  uploadedAt: Date;
}): string | null => {
  if (STORAGE_BACKEND !== "local") {
    return null;
  }
  return absolutePathForKey(mediaStorageKey(input));
};

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
  const sourceOptions =
    outputExt === "gif" || outputExt === "webp"
      ? { animated: true, pages: -1 }
      : undefined;
  const lgBuffer = await sharp(input.previewImageBuffer, sourceOptions)
    .resize({ width: 1024, withoutEnlargement: true })
    .toFormat(outputFormat)
    .toBuffer();
  const smBuffer = await sharp(lgBuffer, sourceOptions)
    .resize({ width: 320, withoutEnlargement: true })
    .toFormat(outputFormat)
    .toBuffer();
  const metadata = await sharp(lgBuffer, sourceOptions).metadata();

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
    height: metadata.pageHeight ?? metadata.height ?? undefined,
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
