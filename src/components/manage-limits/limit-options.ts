export type GroupLimits = {
  id: string
  groupId: string | null
  maxFileSize: number
  maxImageSize: number
  maxVideoSize: number
  maxDocumentSize: number
  maxOtherSize: number
  imageGenerationEnabled: boolean
  allowedTypes: string[]
  rateLimitPerMinute: number
  createdAt: string
  updatedAt: string
}

export type GroupLimitRow = {
  groupId: string
  groupName: string
  userCount: number
  limits: GroupLimits
}

export type MimeCategoryId = "image" | "video" | "document" | "code" | "config" | "software" | "file"

export type MimeCategory = {
  id: MimeCategoryId
  label: string
  description: string
  types: string[]
}

export const MIME_CATEGORIES: MimeCategory[] = [
  {
    id: "image",
    label: "Images",
    description: "Photos, graphics, design files, and browser images",
    types: ["image/*", "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff", "image/svg+xml"]
  },
  {
    id: "video",
    label: "Video",
    description: "Common web, camera, and editing formats",
    types: [
      "video/*",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/mpeg"
    ]
  },
  {
    id: "document",
    label: "Documents",
    description: "Office files, PDFs, text, tables, and presentations",
    types: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.presentation",
      "text/markdown",
      "application/json"
    ]
  },
  {
    id: "code",
    label: "Code & markup",
    description: "Programming languages, scripts, shells, and source files",
    types: [
      "text/*",
      "text/javascript",
      "application/javascript",
      "text/typescript",
      "application/typescript",
      "text/x-python",
      "application/x-python-code",
      "text/x-ruby",
      "text/x-go",
      "text/x-rustsrc",
      "text/x-c",
      "text/x-c++src",
      "text/x-csharp",
      "text/x-java-source",
      "text/x-kotlin",
      "text/x-swift",
      "application/x-httpd-php",
      "application/x-sh",
      "text/x-shellscript",
      "application/x-powershell",
      "application/sql",
      ".js",
      ".mjs",
      ".cjs",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".rb",
      ".go",
      ".rs",
      ".c",
      ".h",
      ".cpp",
      ".hpp",
      ".cs",
      ".java",
      ".kt",
      ".kts",
      ".swift",
      ".php",
      ".sh",
      ".bash",
      ".zsh",
      ".fish",
      ".ps1",
      ".sql",
      ".lua",
      ".r",
      ".dart",
      ".scala",
      ".pl",
      ".pm",
      ".vb"
    ]
  },
  {
    id: "config",
    label: "Config & data",
    description: "Project configuration, structured data, and infrastructure files",
    types: [
      "application/xml",
      "text/xml",
      "text/html",
      "text/css",
      "text/x-scss",
      "text/x-sass",
      "text/x-less",
      "application/yaml",
      "text/yaml",
      "text/x-yaml",
      "application/toml",
      "application/x-ndjson",
      "application/graphql",
      ".jsonc",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".env",
      ".xml",
      ".html",
      ".htm",
      ".css",
      ".scss",
      ".sass",
      ".less",
      ".graphql",
      ".gql",
      ".proto",
      ".tf",
      ".tfvars",
      ".dockerfile",
      ".gitignore",
      ".dockerignore",
      ".npmrc",
      ".editorconfig"
    ]
  },
  {
    id: "software",
    label: "Software & packages",
    description: "Executables, installers, packages, libraries, and databases",
    types: [
      "application/wasm",
      "application/java-archive",
      "application/vnd.android.package-archive",
      "application/x-msdownload",
      "application/vnd.microsoft.portable-executable",
      "application/x-msi",
      "application/x-sharedlib",
      "application/x-executable",
      "application/x-mach-binary",
      "application/x-debian-package",
      "application/vnd.debian.binary-package",
      "application/x-rpm",
      "application/x-apple-diskimage",
      "application/x-iso9660-image",
      "application/x-sqlite3",
      ".wasm",
      ".jar",
      ".war",
      ".ear",
      ".apk",
      ".ipa",
      ".deb",
      ".rpm",
      ".msi",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".dmg",
      ".pkg",
      ".iso",
      ".appimage",
      ".sqlite",
      ".sqlite3",
      ".db"
    ]
  },
  {
    id: "file",
    label: "Audio & archives",
    description: "Audio, compressed archives, and generic binary files",
    types: [
      "audio/*",
      "audio/mpeg",
      "audio/wav",
      "audio/midi",
      "audio/ogg",
      "audio/flac",
      "application/zip",
      "application/x-7z-compressed",
      "application/gzip",
      "application/x-tar",
      "application/vnd.rar",
      "application/octet-stream"
    ]
  }
]

const typesFor = (...categoryIds: MimeCategoryId[]): string[] =>
  MIME_CATEGORIES.filter(category => categoryIds.includes(category.id)).flatMap(category => category.types)

export const MIME_PRESETS = [
  {
    id: "media",
    label: "Media sharing",
    description: "Images, video, and audio",
    types: typesFor("image", "video", "file").filter(type => !type.startsWith("application/"))
  },
  {
    id: "office",
    label: "Office & documents",
    description: "Media plus common document formats",
    types: typesFor("image", "video", "document")
  },
  {
    id: "developer",
    label: "Developer workspace",
    description: "Documents, source code, config, and archives",
    types: typesFor("document", "code", "config", "file").filter(
      type => type !== "application/octet-stream" && !type.startsWith("audio/")
    )
  },
  {
    id: "everything",
    label: "Everything listed",
    description: "All known types, including software packages",
    types: MIME_CATEGORIES.flatMap(category => category.types)
  }
] as const

export const KNOWN_TYPES = new Set(MIME_CATEGORIES.flatMap(category => category.types))

export function normalizeTypes(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))).sort()
}

export function copyEditableLimits(source: GroupLimits, target: GroupLimits): GroupLimits {
  const maxFileSize = Math.max(source.maxImageSize, source.maxVideoSize, source.maxDocumentSize, source.maxOtherSize)
  return {
    ...target,
    maxFileSize,
    maxImageSize: source.maxImageSize,
    maxVideoSize: source.maxVideoSize,
    maxDocumentSize: source.maxDocumentSize,
    maxOtherSize: source.maxOtherSize,
    imageGenerationEnabled: source.imageGenerationEnabled,
    allowedTypes: normalizeTypes(source.allowedTypes),
    rateLimitPerMinute: source.rateLimitPerMinute
  }
}

export function areEditableLimitsEqual(left: GroupLimits, right: GroupLimits): boolean {
  return (
    left.maxImageSize === right.maxImageSize &&
    left.maxVideoSize === right.maxVideoSize &&
    left.maxDocumentSize === right.maxDocumentSize &&
    left.maxOtherSize === right.maxOtherSize &&
    left.imageGenerationEnabled === right.imageGenerationEnabled &&
    left.rateLimitPerMinute === right.rateLimitPerMinute &&
    normalizeTypes(left.allowedTypes).join("\n") === normalizeTypes(right.allowedTypes).join("\n")
  )
}
