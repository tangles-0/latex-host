ALTER TABLE "images" ADD COLUMN "preview_status" text NOT NULL DEFAULT 'complete';
ALTER TABLE "images" ADD COLUMN "preview_error" text;
