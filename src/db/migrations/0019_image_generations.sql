CREATE TABLE "image_generations" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "prompt" text NOT NULL,
  "negative_prompt" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "error" text,
  "media_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX "image_generations_user_created_at_idx"
ON "image_generations" ("user_id", "created_at");

CREATE INDEX "image_generations_status_idx"
ON "image_generations" ("status");
