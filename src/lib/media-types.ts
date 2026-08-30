export const MEDIA_KINDS = [
  "image",
  "video",
  "document",
  "other",
  "note",
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const BLOB_MEDIA_KINDS = [
  "image",
  "video",
  "document",
  "other",
] as const;
export type BlobMediaKind = (typeof BLOB_MEDIA_KINDS)[number];

export const PREVIEWABLE_MEDIA_KINDS = ["image", "video", "document"] as const;
export type AsyncPreviewKind = (typeof PREVIEWABLE_MEDIA_KINDS)[number];

export function isMediaKind(
  value: string | null | undefined,
): value is MediaKind {
  return Boolean(value && MEDIA_KINDS.includes(value as MediaKind));
}

export function isBlobMediaKind(
  value: string | null | undefined,
): value is BlobMediaKind {
  return Boolean(value && BLOB_MEDIA_KINDS.includes(value as BlobMediaKind));
}

export function isAsyncPreviewKind(
  value: string | null | undefined,
): value is AsyncPreviewKind {
  return Boolean(
    value && PREVIEWABLE_MEDIA_KINDS.includes(value as AsyncPreviewKind),
  );
}

export const PDF_EXTENSIONS = new Set(["pdf"]);

export const DOCUMENT_TEXT_EXTENSIONS = new Set([
  "doc",
  "docx",
  "txt",
  "text",
  "rtf",
  "odt",
]);

export const SPREADSHEET_EXTENSIONS = new Set(["xls", "xlsx", "ods"]);

export const PRESENTATION_EXTENSIONS = new Set(["ppt", "pptx", "odp"]);

export const CSV_EXTENSIONS = new Set(["csv", "tsv"]);

export const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "m4v",
  "mov",
  "mkv",
  "webm",
  "avi",
  "mpeg",
  "mpg",
  "wmv",
  "flv",
]);

export const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "svg",
]);

export const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "midi",
  "mid",
  "ogg",
  "aac",
  "flac",
  "m4a",
  "opus",
  "aiff",
  "aif",
  "wma",
]);

/** Multi-segment archive suffixes; longer forms first for matching. */
export const COMPOUND_ARCHIVE_EXTENSIONS = [
  "tar.gz",
  "tar.bz2",
  "tar.xz",
  "tar.zst",
  "tar.lzma",
  "tar.lz",
] as const;

export const ARCHIVE_EXTENSIONS = new Set([
  "zip",
  "7z",
  "gz",
  "gzip",
  "tar",
  "rar",
  "bz2",
  "xz",
  "tgz",
  "tbz2",
  "txz",
  ...COMPOUND_ARCHIVE_EXTENSIONS,
]);

export const CODE_EXTENSIONS = new Set([
  "md",
  "markdown",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "ini",
  "xml",
  "html",
  "css",
  "scss",
  "less",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "rb",
  "go",
  "rs",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "java",
  "kt",
  "kts",
  "swift",
  "php",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "sql",
  "lua",
  "r",
  "dart",
  "scala",
  "pl",
  "pm",
  "vb",
  "sass",
  "env",
  "graphql",
  "gql",
  "proto",
  "tf",
  "tfvars",
  "dockerfile",
  "gitignore",
  "dockerignore",
  "npmrc",
  "editorconfig",
]);

export const DOCUMENT_EXTENSIONS = new Set([
  ...PDF_EXTENSIONS,
  ...DOCUMENT_TEXT_EXTENSIONS,
  ...SPREADSHEET_EXTENSIONS,
  ...PRESENTATION_EXTENSIONS,
  ...CSV_EXTENSIONS,
]);

export const LOCAL_TEXT_PREVIEW_EXTENSIONS = new Set([
  "txt",
  "text",
  "md",
  "markdown",
  ...CSV_EXTENSIONS,
  ...CODE_EXTENSIONS,
]);

export const THUMBNAIL_SERVICE_DOCUMENT_EXTENSIONS = new Set([
  ...PDF_EXTENSIONS,
  "doc",
  "docx",
  "rtf",
  "odt",
  ...SPREADSHEET_EXTENSIONS,
  ...PRESENTATION_EXTENSIONS,
]);

export const MAX_LOCAL_IMAGE_THUMBNAIL_BYTES = 60 * 1024 * 1024;

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  midi: "audio/midi",
  mid: "audio/midi",
  ogg: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  opus: "audio/opus",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  wma: "audio/x-ms-wma",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  rtf: "application/rtf",
  csv: "text/csv",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  gz: "application/gzip",
  tar: "application/x-tar",
  rar: "application/vnd.rar",
  "tar.gz": "application/gzip",
  "tar.bz2": "application/x-bzip2",
  "tar.xz": "application/x-xz",
  "tar.zst": "application/zstd",
  "tar.lzma": "application/x-lzma",
  "tar.lz": "application/x-lzip",
};

export function extFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  for (const compound of COMPOUND_ARCHIVE_EXTENSIONS) {
    const suffix = `.${compound}`;
    if (lower.endsWith(suffix) && lower.length > suffix.length) {
      return compound;
    }
  }
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

/** Stem + extension, preserving compound archive suffixes like tar.gz. */
export function splitFileName(
  fileName: string,
): { stem: string; ext: string } | null {
  const ext = extFromFileName(fileName);
  if (!ext) {
    return null;
  }
  const stem = fileName.slice(0, fileName.length - ext.length - 1);
  if (!stem) {
    return null;
  }
  return { stem, ext };
}

export type SizedMediaFileName = {
  baseName: string;
  size: "original" | "sm" | "lg" | "x640" | "x512";
  ext: string;
};

/**
 * Parse `baseName[-sm|-lg|-640|-512].ext`, including compound archive extensions
 * (e.g. `uuid.tar.gz`).
 */
export function parseSizedFileName(
  fileName: string,
  options?: { allowX640?: boolean; allowX512?: boolean },
): SizedMediaFileName | null {
  const split = splitFileName(fileName);
  if (!split) {
    return null;
  }
  const { stem, ext } = split;
  if (!/^[a-z0-9]+(?:\.[a-z0-9]+)*$/i.test(ext)) {
    return null;
  }

  const extra: string[] = [];
  if (options?.allowX640) {
    extra.push("-640");
  }
  if (options?.allowX512) {
    extra.push("-512");
  }
  const sizePattern = extra.length
    ? new RegExp(`^(.*?)(-sm|-lg|${extra.join("|")})$`)
    : /^(.*?)(-sm|-lg)$/;
  const sizeMatch = sizePattern.exec(stem);
  if (sizeMatch?.[1]) {
    const suffix = sizeMatch[2];
    const size =
      suffix === "-sm"
        ? "sm"
        : suffix === "-lg"
          ? "lg"
          : suffix === "-512"
            ? ("x512" as const)
            : ("x640" as const);
    return { baseName: sizeMatch[1], size, ext };
  }

  return { baseName: stem, size: "original", ext };
}

export function mediaKindFromType(
  mimeType: string,
  ext: string,
): BlobMediaKind {
  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    DOCUMENT_EXTENSIONS.has(ext) ||
    CODE_EXTENSIONS.has(ext)
  ) {
    return "document";
  }
  if (mimeType.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }
  if (mimeType.startsWith("audio/")) {
    return "other";
  }
  return "other";
}

export function contentTypeForExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

/** Text/code docs rendered as monospace PNG previews (offloaded to the worker). */
export function isTextPreviewDocument(mimeType: string, ext: string): boolean {
  const normalizedMime = mimeType.toLowerCase();
  const normalizedExt = ext.toLowerCase();
  return (
    normalizedMime.startsWith("text/") ||
    LOCAL_TEXT_PREVIEW_EXTENSIONS.has(normalizedExt)
  );
}

/** Max UTF-8 bytes accepted for in-browser text/code editing (Monaco). */
export const MAX_EDITABLE_TEXT_DOCUMENT_BYTES = 2 * 1024 * 1024;

/**
 * Uploaded documents that can be opened in the gallery text/code editor.
 * Excludes office/PDF binaries even if somehow marked text/*.
 */
export function isEditableTextDocument(mimeType: string, ext: string): boolean {
  const normalizedMime = mimeType.toLowerCase();
  const normalizedExt = ext.toLowerCase();
  if (
    PDF_EXTENSIONS.has(normalizedExt) ||
    THUMBNAIL_SERVICE_DOCUMENT_EXTENSIONS.has(normalizedExt) ||
    SPREADSHEET_EXTENSIONS.has(normalizedExt) ||
    PRESENTATION_EXTENSIONS.has(normalizedExt)
  ) {
    return false;
  }
  if (
    normalizedMime.includes("pdf") ||
    normalizedMime.includes("msword") ||
    normalizedMime.includes("officedocument") ||
    normalizedMime.includes("opendocument") ||
    normalizedMime.includes("ms-excel") ||
    normalizedMime.includes("powerpoint")
  ) {
    return false;
  }
  return isTextPreviewDocument(normalizedMime, normalizedExt);
}

/** Monaco language id for a file extension (best-effort). */
export function monacoLanguageFromExt(ext: string): string {
  const normalized = ext.toLowerCase();
  const map: Record<string, string> = {
    md: "markdown",
    markdown: "markdown",
    json: "json",
    jsonc: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    ini: "ini",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    sass: "scss",
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cs: "csharp",
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    swift: "swift",
    php: "php",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "powershell",
    sql: "sql",
    lua: "lua",
    r: "r",
    dart: "dart",
    scala: "scala",
    pl: "perl",
    pm: "perl",
    graphql: "graphql",
    gql: "graphql",
    proto: "protobuf",
    dockerfile: "dockerfile",
    txt: "plaintext",
    text: "plaintext",
    csv: "plaintext",
    tsv: "plaintext",
    env: "ini",
    gitignore: "plaintext",
    dockerignore: "plaintext",
    npmrc: "ini",
    editorconfig: "ini",
    tf: "plaintext",
    tfvars: "plaintext",
  };
  return map[normalized] ?? "plaintext";
}

/** @deprecated Prefer isTextPreviewDocument — kept for call-site compatibility. */
export const isLocalTextPreviewDocument = isTextPreviewDocument;

export function isOfficeOrPdfDocument(mimeType: string, ext: string): boolean {
  const normalizedMime = mimeType.toLowerCase();
  const normalizedExt = ext.toLowerCase();
  return (
    normalizedMime.includes("pdf") ||
    normalizedMime.includes("document") ||
    normalizedMime.includes("spreadsheet") ||
    normalizedMime.includes("presentation") ||
    normalizedMime.includes("msword") ||
    normalizedMime.includes("ms-excel") ||
    normalizedMime.includes("powerpoint") ||
    normalizedMime.includes("opendocument") ||
    normalizedMime.includes("rtf") ||
    THUMBNAIL_SERVICE_DOCUMENT_EXTENSIONS.has(normalizedExt)
  );
}

export function isThumbnailServiceSupported(input: {
  kind: BlobMediaKind;
  mimeType: string;
  ext: string;
  fileSizeBytes: number;
}): input is {
  kind: AsyncPreviewKind;
  mimeType: string;
  ext: string;
  fileSizeBytes: number;
} {
  const normalizedMime = input.mimeType.toLowerCase();
  const normalizedExt = input.ext.toLowerCase();
  if (input.kind === "image") {
    return (
      input.fileSizeBytes > MAX_LOCAL_IMAGE_THUMBNAIL_BYTES &&
      normalizedExt !== "svg" &&
      (normalizedMime.startsWith("image/") ||
        IMAGE_EXTENSIONS.has(normalizedExt))
    );
  }
  if (input.kind === "video") {
    return (
      normalizedMime.startsWith("video/") || VIDEO_EXTENSIONS.has(normalizedExt)
    );
  }
  if (input.kind === "document") {
    return (
      isTextPreviewDocument(normalizedMime, normalizedExt) ||
      isOfficeOrPdfDocument(normalizedMime, normalizedExt)
    );
  }
  return false;
}

/** Extensions/mimes that warrant a confirmation before enabling a public share. */
export const RISKY_SHARE_EXTENSIONS = new Set([
  ...ARCHIVE_EXTENSIONS,
  "exe",
  "msi",
  "dll",
  "so",
  "dylib",
  "apk",
  "ipa",
  "deb",
  "rpm",
  "jar",
  "war",
  "ear",
  "dmg",
  "pkg",
  "appimage",
  "iso",
  "wasm",
  "bat",
  "cmd",
  "com",
  "scr",
  "vbs",
  "ps1",
  "html",
  "htm",
  "svg",
  "xhtml",
  "xml",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "php",
  "asp",
  "aspx",
  "jsp",
  "cgi",
  "env",
  "npmrc",
  "pem",
  "key",
  "p12",
  "pfx",
  "sqlite",
  "sqlite3",
  "db",
]);

export function isRiskyShareFile(input: {
  kind: MediaKind | string;
  ext: string;
  mimeType?: string;
}): boolean {
  if (input.kind === "note") {
    return false;
  }
  const normalizedExt = input.ext.toLowerCase();
  const normalizedMime = (input.mimeType ?? "").toLowerCase();
  if (RISKY_SHARE_EXTENSIONS.has(normalizedExt)) {
    return true;
  }
  if (
    normalizedMime.includes("executable") ||
    normalizedMime.includes("msdownload") ||
    normalizedMime.includes("java-archive") ||
    normalizedMime.includes("android.package") ||
    normalizedMime.includes("x-msdos-program") ||
    normalizedMime === "text/html" ||
    normalizedMime === "image/svg+xml" ||
    normalizedMime === "application/javascript" ||
    normalizedMime === "text/javascript" ||
    normalizedMime === "application/x-sh" ||
    normalizedMime === "application/x-bat"
  ) {
    return true;
  }
  return false;
}
