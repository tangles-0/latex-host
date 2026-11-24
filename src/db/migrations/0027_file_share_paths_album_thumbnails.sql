CREATE TABLE IF NOT EXISTS "file_share_paths" (
  "path" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "size" text NOT NULL,
  "created_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "file_share_paths_code_idx"
  ON "file_share_paths" USING btree ("code");

CREATE UNIQUE INDEX IF NOT EXISTS "file_share_paths_code_size_unique"
  ON "file_share_paths" USING btree ("code", "size");

ALTER TABLE "media_in_albums"
  ADD COLUMN IF NOT EXISTS "album_thumbnail_url" text;
