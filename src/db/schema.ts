import {
  pgTable,
  text,
  integer,
  bigint,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const shareCodeRegistry = pgTable("share_code_registry", {
  code: text("code").primaryKey(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const groupLimits = pgTable("group_limits", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => groups.id),
  maxFileSize: bigint("max_file_size", { mode: "number" }).notNull(),
  maxImageSize: bigint("max_image_size", { mode: "number" }).notNull(),
  maxVideoSize: bigint("max_video_size", { mode: "number" }).notNull(),
  maxDocumentSize: bigint("max_document_size", { mode: "number" }).notNull(),
  maxOtherSize: bigint("max_other_size", { mode: "number" }).notNull(),
  imageGenerationEnabled: boolean("image_generation_enabled")
    .notNull()
    .default(false),
  allowedTypes: text("allowed_types").notNull(),
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  motd: text("motd").notNull(),
  costThisMonth: integer("cost_this_month").notNull(),
  fundedThisMonth: integer("funded_this_month").notNull(),
  donateUrl: text("donate_url"),
  supportEnabled: boolean("support_enabled").notNull().default(true),
  signupsEnabled: boolean("signups_enabled").notNull().default(true),
  uploadsEnabled: boolean("uploads_enabled").notNull().default(true),
  shareHtmlNavigationEnabled: boolean("share_html_navigation_enabled")
    .notNull()
    .default(true),
  resumableThresholdBytes: bigint("resumable_threshold_bytes", {
    mode: "number",
  })
    .notNull()
    .default(64 * 1024 * 1024),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordResetTokenHash: text("password_reset_token_hash"),
  passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at", {
    mode: "date",
  }),
  groupId: text("group_id").references(() => groups.id),
  theme: text("theme").notNull().default("dark"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  lastPatchNoteDismissed: timestamp("last_patch_note_dismissed", {
    mode: "date",
  }),
  bannedAt: timestamp("banned_at", { mode: "date" }),
});

export const selfHostedNodes = pgTable(
  "self_hosted_nodes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    linkCodeHash: text("link_code_hash").unique(),
    linkCodeExpiresAt: timestamp("link_code_expires_at", { mode: "date" }),
    nodeHash: text("node_hash").unique(),
    publicHttpsUrl: text("public_https_url"),
    status: text("status").notNull().default("not_linked"),
    forwardingEnabled: boolean("forwarding_enabled").notNull().default(false),
    isOwnerDisabled: boolean("is_owner_disabled").notNull().default(false),
    isAdminDisabled: boolean("is_admin_disabled").notNull().default(false),
    authSecretHash: text("auth_secret_hash"),
    cloudAccessSecret: text("cloud_access_secret"),
    lastPingAt: timestamp("last_ping_at", { mode: "date" }),
    lastReachabilityAt: timestamp("last_reachability_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("self_hosted_nodes_user_id_idx").on(table.userId),
    nodeHashIdx: uniqueIndex("self_hosted_nodes_node_hash_idx").on(
      table.nodeHash,
    ),
  }),
);

export const nodeLoginCodes = pgTable(
  "node_login_codes",
  {
    id: text("id").primaryKey(),
    nodeId: text("node_id")
      .notNull()
      .references(() => selfHostedNodes.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    nodeIdIdx: index("node_login_codes_node_id_idx").on(table.nodeId),
    expiresAtIdx: index("node_login_codes_expires_at_idx").on(table.expiresAt),
  }),
);

export const nodeInstanceSettings = pgTable("node_instance_settings", {
  id: text("id").primaryKey(),
  cloudBaseUrl: text("cloud_base_url").notNull(),
  publicHttpsUrl: text("public_https_url"),
  nodeHash: text("node_hash"),
  authSecret: text("auth_secret"),
  cloudAccessSecret: text("cloud_access_secret"),
  setupChallenge: text("setup_challenge").notNull(),
  linkedCloudUserId: text("linked_cloud_user_id"),
  linkedAt: timestamp("linked_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const patchNotes = pgTable("patch_notes", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  publishedAt: timestamp("published_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const albums = pgTable("albums", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  displayAsDownloadPage: boolean("display_as_download_page")
    .notNull()
    .default(false),
  displayAsCompactView: boolean("display_as_compact_view")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const nodeImportJobs = pgTable(
  "node_import_jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    selectedPaths: jsonb("selected_paths").$type<string[]>().notNull(),
    albumId: text("album_id").references(() => albums.id, {
      onDelete: "set null",
    }),
    isShareAll: boolean("is_share_all").notNull().default(false),
    totalFiles: integer("total_files").notNull().default(0),
    completedFiles: integer("completed_files").notNull().default(0),
    failedFiles: integer("failed_files").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => ({
    statusCreatedAtIdx: index("node_import_jobs_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
    userIdIdx: index("node_import_jobs_user_id_idx").on(table.userId),
  }),
);

export const nodeImportItems = pgTable(
  "node_import_items",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => nodeImportJobs.id, { onDelete: "cascade" }),
    relativePath: text("relative_path").notNull(),
    status: text("status").notNull().default("pending"),
    mediaId: text("media_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    jobPathUnique: uniqueIndex("node_import_items_job_path_unique").on(
      table.jobId,
      table.relativePath,
    ),
    jobStatusIdx: index("node_import_items_job_status_idx").on(
      table.jobId,
      table.status,
    ),
  }),
);

export const thumbnailGenerationJobs = pgTable(
  "thumbnail_generation_jobs",
  {
    mediaId: text("media_id").primaryKey(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    failureReason: text("failure_reason"),
    lastError: text("last_error"),
    sourceUrl: text("source_url"),
    localSourcePath: text("local_source_path"),
    contentType: text("content_type").notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    youtubeId: text("youtube_id"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    downloadedPath: text("downloaded_path"),
    thumbnailPath: text("thumbnail_path"),
    generationDurationMs: integer("generation_duration_ms"),
    sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    downloadedAt: timestamp("downloaded_at", {
      mode: "date",
      withTimezone: true,
    }),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    createdThumbnailAt: timestamp("created_thumbnail_at", {
      mode: "date",
      withTimezone: true,
    }),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    nextAttemptAt: timestamp("next_attempt_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    claimToken: text("claim_token"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => ({
    statusIdx: index("thumbnail_generation_jobs_status_idx").on(table.status),
    queueIdx: index("thumbnail_generation_jobs_queue_idx").on(
      table.status,
      table.nextAttemptAt,
    ),
    createdAtIdx: index("thumbnail_generation_jobs_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

// Shared with latex-preview-gen when the node stack uses one PostgreSQL.
export const youtubeVideos = pgTable(
  "youtube_videos",
  {
    youtubeId: text("youtube_id").primaryKey(),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    channelName: text("channel_name").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    qualities: jsonb("qualities")
      .$type<
        Array<{
          id: string;
          label: string;
          height: number | null;
          fps: number | null;
          ext: string;
          filesizeBytes: number | null;
        }>
      >()
      .notNull(),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailPath: text("thumbnail_path"),
    rawMetadata: jsonb("raw_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    titleIdx: index("youtube_videos_title_idx").on(table.title),
  }),
);

export const youtubeIngestJobs = pgTable(
  "youtube_ingest_jobs",
  {
    ingestId: text("ingest_id").primaryKey(),
    userId: text("user_id").notNull(),
    youtubeId: text("youtube_id")
      .notNull()
      .references(() => youtubeVideos.youtubeId),
    qualityId: text("quality_id").notNull(),
    outputType: text("output_type").notNull().default("video"),
    status: text("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    error: text("error"),
    downloadedPath: text("downloaded_path"),
    uploadedMediaId: text("uploaded_media_id"),
    fileName: text("file_name"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    mimeType: text("mime_type"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    youtubeIdIdx: index("youtube_ingest_jobs_youtube_id_idx").on(
      table.youtubeId,
    ),
    statusIdx: index("youtube_ingest_jobs_status_idx").on(table.status),
  }),
);

export const imageGenerationJobs = pgTable(
  "image_generation_jobs",
  {
    generationId: text("generation_id").primaryKey(),
    userId: text("user_id").notNull(),
    prompt: text("prompt").notNull(),
    negativePrompt: text("negative_prompt"),
    expandPrompt: boolean("expand_prompt").notNull().default(false),
    expandedPrompt: text("expanded_prompt"),
    status: text("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    outputPath: text("output_path"),
    uploadedMediaId: text("uploaded_media_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index("image_generation_jobs_status_idx").on(table.status),
    createdAtIdx: index("image_generation_jobs_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const mediaInAlbums = pgTable(
  "media_in_albums",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id),
    mediaType: text("media_type").notNull(),
    mediaId: text("media_id").notNull(),
    albumCaption: text("album_caption"),
    albumOrder: integer("album_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    albumMediaUnique: uniqueIndex("media_in_albums_album_media_unique").on(
      table.albumId,
      table.mediaType,
      table.mediaId,
    ),
  }),
);

export const images = pgTable("images", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  albumId: text("album_id").references(() => albums.id),
  albumCaption: text("album_caption"),
  albumOrder: integer("album_order").notNull().default(0),
  baseName: text("base_name").notNull(),
  originalFileName: text("original_file_name"),
  generationPrompt: text("generation_prompt"),
  ext: text("ext").notNull().default("jpg"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sizeOriginal: bigint("size_original", { mode: "number" })
    .notNull()
    .default(0),
  sizeSm: bigint("size_sm", { mode: "number" }).notNull().default(0),
  sizeLg: bigint("size_lg", { mode: "number" }).notNull().default(0),
  previewStatus: text("preview_status").notNull().default("complete"),
  previewError: text("preview_error"),
  uploadedAt: timestamp("uploaded_at", { mode: "date" }).notNull(),
});

export const videos = pgTable("videos", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  albumId: text("album_id").references(() => albums.id),
  albumCaption: text("album_caption"),
  albumOrder: integer("album_order").notNull().default(0),
  baseName: text("base_name").notNull(),
  originalFileName: text("original_file_name"),
  generationPrompt: text("generation_prompt"),
  ext: text("ext").notNull(),
  mimeType: text("mime_type").notNull(),
  youtubeId: text("youtube_id"),
  durationSeconds: integer("duration_seconds"),
  width: integer("width"),
  height: integer("height"),
  sizeOriginal: bigint("size_original", { mode: "number" })
    .notNull()
    .default(0),
  sizeSm: bigint("size_sm", { mode: "number" }).notNull().default(0),
  sizeLg: bigint("size_lg", { mode: "number" }).notNull().default(0),
  previewStatus: text("preview_status").notNull().default("pending"),
  previewError: text("preview_error"),
  uploadedAt: timestamp("uploaded_at", { mode: "date" }).notNull(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  albumId: text("album_id").references(() => albums.id),
  albumCaption: text("album_caption"),
  albumOrder: integer("album_order").notNull().default(0),
  baseName: text("base_name").notNull(),
  originalFileName: text("original_file_name"),
  generationPrompt: text("generation_prompt"),
  ext: text("ext").notNull(),
  mimeType: text("mime_type").notNull(),
  pageCount: integer("page_count"),
  sizeOriginal: bigint("size_original", { mode: "number" })
    .notNull()
    .default(0),
  sizeSm: bigint("size_sm", { mode: "number" }).notNull().default(0),
  sizeLg: bigint("size_lg", { mode: "number" }).notNull().default(0),
  previewStatus: text("preview_status").notNull().default("pending"),
  previewError: text("preview_error"),
  uploadedAt: timestamp("uploaded_at", { mode: "date" }).notNull(),
});

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  albumId: text("album_id").references(() => albums.id),
  albumCaption: text("album_caption"),
  albumOrder: integer("album_order").notNull().default(0),
  baseName: text("base_name").notNull(),
  originalFileName: text("original_file_name"),
  generationPrompt: text("generation_prompt"),
  ext: text("ext").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeOriginal: bigint("size_original", { mode: "number" })
    .notNull()
    .default(0),
  sizeSm: bigint("size_sm", { mode: "number" }).notNull().default(0),
  sizeLg: bigint("size_lg", { mode: "number" }).notNull().default(0),
  previewStatus: text("preview_status").notNull().default("pending"),
  previewError: text("preview_error"),
  uploadedAt: timestamp("uploaded_at", { mode: "date" }).notNull(),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  albumId: text("album_id").references(() => albums.id),
  albumCaption: text("album_caption"),
  albumOrder: integer("album_order").notNull().default(0),
  baseName: text("base_name").notNull(),
  originalFileName: text("original_file_name"),
  generationPrompt: text("generation_prompt"),
  content: text("content").notNull().default(""),
  sizeOriginal: bigint("size_original", { mode: "number" })
    .notNull()
    .default(0),
  uploadedAt: timestamp("uploaded_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const noteHistories = pgTable(
  "note_histories",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    sizeOriginal: bigint("size_original", { mode: "number" })
      .notNull()
      .default(0),
    savedAt: timestamp("saved_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    noteHistoriesNoteSavedAtIdx: index("note_histories_note_saved_at_idx").on(
      table.noteId,
      table.savedAt,
    ),
  }),
);

export const shares = pgTable("shares", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  imageId: text("image_id")
    .notNull()
    .references(() => images.id),
  code: text("code").unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const videoShares = pgTable("video_shares", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  videoId: text("video_id")
    .notNull()
    .references(() => videos.id),
  code: text("code").unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const documentShares = pgTable("document_shares", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id),
  code: text("code").unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const fileShares = pgTable("file_shares", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id),
  code: text("code").unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const noteShares = pgTable("note_shares", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id),
  code: text("code").unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const albumShares = pgTable("album_shares", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  albumId: text("album_id")
    .notNull()
    .references(() => albums.id),
  code: text("code").unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const uploadSessions = pgTable("upload_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  backend: text("backend").notNull().default("local"),
  targetType: text("target_type").notNull().default("file"),
  mimeType: text("mime_type").notNull(),
  ext: text("ext").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull().default(0),
  chunkSize: integer("chunk_size").notNull().default(0),
  totalParts: integer("total_parts").notNull().default(0),
  state: text("state").notNull().default("initiated"),
  storageKey: text("storage_key"),
  s3UploadId: text("s3_upload_id"),
  uploadedPartsJson: text("uploaded_parts_json").notNull().default("{}"),
  checksum: text("checksum"),
  error: text("error"),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const youtubeIngests = pgTable("youtube_ingests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  youtubeId: text("youtube_id").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  title: text("title").notNull(),
  channelName: text("channel_name"),
  durationSeconds: integer("duration_seconds"),
  qualityLabel: text("quality_label"),
  outputType: text("output_type").notNull().default("video"),
  status: text("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  error: text("error"),
  mediaId: text("media_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

export const imageGenerations = pgTable(
  "image_generations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    prompt: text("prompt").notNull(),
    negativePrompt: text("negative_prompt"),
    expandPrompt: boolean("expand_prompt").notNull().default(false),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    mediaId: text("media_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => ({
    userCreatedAtIdx: index("image_generations_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    statusIdx: index("image_generations_status_idx").on(table.status),
  }),
);

export const userPgpKeys = pgTable(
  "user_pgp_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    fingerprint: text("fingerprint").notNull(),
    publicKeyArmored: text("public_key_armored").notNull(),
    status: text("status").notNull().default("pending"),
    verifyCodeHash: text("verify_code_hash"),
    verifyChallengeCiphertext: text("verify_challenge_ciphertext"),
    verifyExpiresAt: timestamp("verify_expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    userPgpKeysUserUnique: uniqueIndex("user_pgp_keys_user_id_unique").on(
      table.userId,
    ),
    userPgpKeysFingerprintIdx: index("user_pgp_keys_fingerprint_idx").on(
      table.fingerprint,
    ),
  }),
);

export const senderHashes = pgTable(
  "sender_hashes",
  {
    id: text("id").primaryKey(),
    recipientFingerprint: text("recipient_fingerprint").notNull(),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id),
    displayHash: text("display_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    senderHashesPairUnique: uniqueIndex(
      "sender_hashes_recipient_sender_unique",
    ).on(table.recipientFingerprint, table.senderUserId),
    senderHashesDisplayUnique: uniqueIndex(
      "sender_hashes_recipient_display_unique",
    ).on(table.recipientFingerprint, table.displayHash),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    recipientFingerprint: text("recipient_fingerprint").notNull(),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id),
    senderHash: text("sender_hash").notNull(),
    ciphertext: text("ciphertext").notNull(),
    size: integer("size").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
  },
  (table) => ({
    messagesRecipientCreatedIdx: index("messages_recipient_created_idx").on(
      table.recipientFingerprint,
      table.createdAt,
    ),
    messagesRecipientSenderHashIdx: index(
      "messages_recipient_sender_hash_idx",
    ).on(table.recipientFingerprint, table.senderHash),
  }),
);

export const messageMutes = pgTable(
  "message_mutes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    senderHash: text("sender_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    messageMutesUserHashUnique: uniqueIndex(
      "message_mutes_user_sender_hash_unique",
    ).on(table.userId, table.senderHash),
  }),
);

export const deviceAuthCodes = pgTable(
  "device_auth_codes",
  {
    id: text("id").primaryKey(),
    deviceCodeHash: text("device_code_hash").notNull().unique(),
    userCode: text("user_code").notNull().unique(),
    deviceName: text("device_name"),
    status: text("status").notNull().default("pending"),
    userId: text("user_id").references(() => users.id),
    apiDeviceId: text("api_device_id"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    intervalSeconds: integer("interval_seconds").notNull().default(5),
    lastPollAt: timestamp("last_poll_at", { mode: "date" }),
    approvedAt: timestamp("approved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    deviceAuthCodesStatusIdx: index("device_auth_codes_status_idx").on(
      table.status,
    ),
  }),
);

export const apiDevices = pgTable(
  "api_devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull().default("TUI"),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    scopes: text("scopes").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
  },
  (table) => ({
    apiDevicesUserIdx: index("api_devices_user_id_idx").on(table.userId),
  }),
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    description: text("description").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    tokenLastFour: text("token_last_four").notNull(),
    allowedDomains: jsonb("allowed_domains").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
  },
  (table) => ({
    apiKeysUserIdx: index("api_keys_user_id_idx").on(table.userId),
  }),
);

export const abuseReports = pgTable(
  "abuse_reports",
  {
    id: text("id").primaryKey(),
    description: text("description").notNull(),
    urls: jsonb("urls").$type<string[]>().notNull(),
    reporterEmail: text("reporter_email"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
    resolutionNote: text("resolution_note"),
  },
  (table) => ({
    abuseReportsStatusIdx: index("abuse_reports_status_idx").on(table.status),
    abuseReportsCreatedAtIdx: index("abuse_reports_created_at_idx").on(
      table.createdAt,
    ),
  }),
);
