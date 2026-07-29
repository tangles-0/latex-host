CREATE TABLE IF NOT EXISTS "device_auth_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "device_code_hash" text NOT NULL UNIQUE,
  "user_code" text NOT NULL UNIQUE,
  "device_name" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "user_id" text REFERENCES "users"("id"),
  "api_device_id" text,
  "expires_at" timestamp NOT NULL,
  "interval_seconds" integer DEFAULT 5 NOT NULL,
  "last_poll_at" timestamp,
  "approved_at" timestamp,
  "created_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "device_auth_codes_status_idx" ON "device_auth_codes" ("status");

CREATE TABLE IF NOT EXISTS "api_devices" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "name" text DEFAULT 'TUI' NOT NULL,
  "refresh_token_hash" text NOT NULL UNIQUE,
  "scopes" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "last_used_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp
);

CREATE INDEX IF NOT EXISTS "api_devices_user_id_idx" ON "api_devices" ("user_id");
