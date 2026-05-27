CREATE TABLE "note_histories" (
  "id" text PRIMARY KEY NOT NULL,
  "note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "content" text NOT NULL,
  "size_original" bigint NOT NULL DEFAULT 0,
  "saved_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL
);

CREATE INDEX "note_histories_note_saved_at_idx" ON "note_histories" ("note_id", "saved_at");
