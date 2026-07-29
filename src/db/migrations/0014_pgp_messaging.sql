CREATE TABLE IF NOT EXISTS "user_pgp_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "fingerprint" text NOT NULL,
  "public_key_armored" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "verify_code_hash" text,
  "verify_challenge_ciphertext" text,
  "verify_expires_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_pgp_keys_user_id_unique" ON "user_pgp_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "user_pgp_keys_fingerprint_idx" ON "user_pgp_keys" ("fingerprint");
CREATE UNIQUE INDEX IF NOT EXISTS "user_pgp_keys_claimed_fingerprint_unique"
  ON "user_pgp_keys" ("fingerprint")
  WHERE "status" = 'claimed';

CREATE TABLE IF NOT EXISTS "sender_hashes" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient_fingerprint" text NOT NULL,
  "sender_user_id" text NOT NULL REFERENCES "users"("id"),
  "display_hash" text NOT NULL,
  "created_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sender_hashes_recipient_sender_unique"
  ON "sender_hashes" ("recipient_fingerprint", "sender_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sender_hashes_recipient_display_unique"
  ON "sender_hashes" ("recipient_fingerprint", "display_hash");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient_fingerprint" text NOT NULL,
  "sender_user_id" text NOT NULL REFERENCES "users"("id"),
  "sender_hash" text NOT NULL,
  "ciphertext" text NOT NULL,
  "size" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp NOT NULL,
  "read_at" timestamp
);

CREATE INDEX IF NOT EXISTS "messages_recipient_created_idx"
  ON "messages" ("recipient_fingerprint", "created_at");
CREATE INDEX IF NOT EXISTS "messages_recipient_sender_hash_idx"
  ON "messages" ("recipient_fingerprint", "sender_hash");

CREATE TABLE IF NOT EXISTS "message_mutes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "sender_hash" text NOT NULL,
  "created_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "message_mutes_user_sender_hash_unique"
  ON "message_mutes" ("user_id", "sender_hash");
