ALTER TABLE "self_hosted_nodes"
  ADD COLUMN IF NOT EXISTS "is_admin_disabled" boolean DEFAULT false NOT NULL;
