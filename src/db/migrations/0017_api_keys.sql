CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "description" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "token_prefix" text NOT NULL,
  "token_last_four" text NOT NULL,
  "allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "last_used_at" timestamp,
  "revoked_at" timestamp
);

CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" ("user_id");
