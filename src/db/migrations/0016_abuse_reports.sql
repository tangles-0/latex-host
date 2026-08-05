ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned_at" timestamp;

CREATE TABLE IF NOT EXISTS "abuse_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "description" text NOT NULL,
  "urls" jsonb NOT NULL,
  "reporter_email" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp NOT NULL,
  "resolved_at" timestamp,
  "resolved_by_user_id" text REFERENCES "users"("id"),
  "resolution_note" text
);

CREATE INDEX IF NOT EXISTS "abuse_reports_status_idx" ON "abuse_reports" ("status");
CREATE INDEX IF NOT EXISTS "abuse_reports_created_at_idx" ON "abuse_reports" ("created_at");
