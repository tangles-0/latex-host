ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "public_blob_key" text;
ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "public_blob_url" text;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "public_blob_key" text;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "public_blob_url" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "public_blob_key" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "public_blob_url" text;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "public_blob_key" text;
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "public_blob_url" text;
