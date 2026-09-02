CREATE TABLE IF NOT EXISTS "share_code_registry" (
  "code" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "self_hosted_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "link_code_hash" text UNIQUE,
  "link_code_expires_at" timestamp,
  "node_hash" text UNIQUE,
  "public_https_url" text,
  "status" text DEFAULT 'not_linked' NOT NULL,
  "forwarding_enabled" boolean DEFAULT false NOT NULL,
  "is_owner_disabled" boolean DEFAULT false NOT NULL,
  "auth_secret_hash" text,
  "cloud_access_secret" text,
  "last_ping_at" timestamp,
  "last_reachability_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "self_hosted_nodes_user_id_idx"
  ON "self_hosted_nodes" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "self_hosted_nodes_node_hash_idx"
  ON "self_hosted_nodes" ("node_hash");

CREATE TABLE IF NOT EXISTS "node_login_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "node_id" text NOT NULL REFERENCES "self_hosted_nodes"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "node_login_codes_node_id_idx"
  ON "node_login_codes" ("node_id");
CREATE INDEX IF NOT EXISTS "node_login_codes_expires_at_idx"
  ON "node_login_codes" ("expires_at");

CREATE TABLE IF NOT EXISTS "node_instance_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "cloud_base_url" text NOT NULL,
  "public_https_url" text,
  "node_hash" text,
  "auth_secret" text,
  "cloud_access_secret" text,
  "setup_challenge" text NOT NULL,
  "linked_cloud_user_id" text,
  "linked_at" timestamp,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "node_import_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "selected_paths" jsonb NOT NULL,
  "album_id" text REFERENCES "albums"("id") ON DELETE SET NULL,
  "is_share_all" boolean DEFAULT false NOT NULL,
  "total_files" integer DEFAULT 0 NOT NULL,
  "completed_files" integer DEFAULT 0 NOT NULL,
  "failed_files" integer DEFAULT 0 NOT NULL,
  "error" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "node_import_jobs_status_created_at_idx"
  ON "node_import_jobs" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "node_import_jobs_user_id_idx"
  ON "node_import_jobs" ("user_id");

CREATE TABLE IF NOT EXISTS "node_import_items" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL REFERENCES "node_import_jobs"("id") ON DELETE CASCADE,
  "relative_path" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "media_id" text,
  "error" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "node_import_items_job_path_unique"
  ON "node_import_items" ("job_id", "relative_path");
CREATE INDEX IF NOT EXISTS "node_import_items_job_status_idx"
  ON "node_import_items" ("job_id", "status");

CREATE TABLE IF NOT EXISTS "thumbnail_generation_jobs" (
  "media_id" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "failure_reason" text,
  "last_error" text,
  "source_url" text,
  "local_source_path" text,
  "content_type" text NOT NULL,
  "mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
  "youtube_id" text,
  "file_size_bytes" bigint NOT NULL,
  "downloaded_path" text,
  "thumbnail_path" text,
  "generation_duration_ms" integer,
  "source_metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "downloaded_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "created_thumbnail_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "claim_token" text,
  "lease_expires_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "thumbnail_generation_jobs_status_idx"
  ON "thumbnail_generation_jobs" ("status");
CREATE INDEX IF NOT EXISTS "thumbnail_generation_jobs_queue_idx"
  ON "thumbnail_generation_jobs" ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "thumbnail_generation_jobs_created_at_idx"
  ON "thumbnail_generation_jobs" ("created_at");

CREATE TABLE IF NOT EXISTS "youtube_videos" (
  "youtube_id" text PRIMARY KEY NOT NULL,
  "source_url" text NOT NULL,
  "title" text NOT NULL,
  "channel_name" text NOT NULL,
  "duration_seconds" integer NOT NULL,
  "qualities" jsonb NOT NULL,
  "thumbnail_url" text,
  "thumbnail_path" text,
  "raw_metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "youtube_videos_title_idx"
  ON "youtube_videos" ("title");

CREATE TABLE IF NOT EXISTS "youtube_ingest_jobs" (
  "ingest_id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "youtube_id" text NOT NULL REFERENCES "youtube_videos"("youtube_id"),
  "quality_id" text NOT NULL,
  "output_type" text DEFAULT 'video' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "error" text,
  "downloaded_path" text,
  "uploaded_media_id" text,
  "file_name" text,
  "file_size_bytes" bigint,
  "mime_type" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "youtube_ingest_jobs_youtube_id_idx"
  ON "youtube_ingest_jobs" ("youtube_id");
CREATE INDEX IF NOT EXISTS "youtube_ingest_jobs_status_idx"
  ON "youtube_ingest_jobs" ("status");

CREATE TABLE IF NOT EXISTS "image_generation_jobs" (
  "generation_id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "prompt" text NOT NULL,
  "negative_prompt" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "failure_reason" text,
  "output_path" text,
  "uploaded_media_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "image_generation_jobs_status_idx"
  ON "image_generation_jobs" ("status");
CREATE INDEX IF NOT EXISTS "image_generation_jobs_created_at_idx"
  ON "image_generation_jobs" ("created_at");
