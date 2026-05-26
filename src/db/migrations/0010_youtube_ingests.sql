ALTER TABLE "videos" ADD COLUMN "youtube_id" text;

CREATE TABLE "youtube_ingests" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "youtube_id" text NOT NULL,
  "youtube_url" text NOT NULL,
  "title" text NOT NULL,
  "channel_name" text,
  "duration_seconds" integer,
  "quality_label" text,
  "status" text NOT NULL DEFAULT 'pending',
  "progress" integer NOT NULL DEFAULT 0,
  "error" text,
  "media_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
