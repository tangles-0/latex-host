ALTER TABLE "images" ADD COLUMN "generation_prompt" text;
ALTER TABLE "videos" ADD COLUMN "generation_prompt" text;
ALTER TABLE "documents" ADD COLUMN "generation_prompt" text;
ALTER TABLE "files" ADD COLUMN "generation_prompt" text;
ALTER TABLE "notes" ADD COLUMN "generation_prompt" text;
ALTER TABLE "image_generations"
ADD COLUMN "expand_prompt" boolean DEFAULT false NOT NULL;
ALTER TABLE "image_generation_jobs"
ADD COLUMN IF NOT EXISTS "expand_prompt" boolean DEFAULT false NOT NULL;
ALTER TABLE "image_generation_jobs"
ADD COLUMN IF NOT EXISTS "expanded_prompt" text;

