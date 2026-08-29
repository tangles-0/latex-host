import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { imageGenerations } from "@/db/schema";
import type {
  ImageGenerationEntry,
  ImageGenerationInput,
  ImageGenerationStatus,
} from "@/lib/image-generations/types";

const activeStatuses: ImageGenerationStatus[] = [
  "pending",
  "generating",
  "uploading",
];

const mapImageGeneration = (
  row: typeof imageGenerations.$inferSelect,
): ImageGenerationEntry => ({
  id: row.id,
  prompt: row.prompt,
  negativePrompt: row.negativePrompt ?? undefined,
  status: row.status as ImageGenerationStatus,
  error: row.error ?? undefined,
  mediaId: row.mediaId ?? undefined,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  completedAt: row.completedAt?.toISOString(),
});

export const createImageGenerationForUser = async (
  userId: string,
  input: ImageGenerationInput,
) => {
  const now = new Date();
  const [created] = await db
    .insert(imageGenerations)
    .values({
      id: randomUUID(),
      userId,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt || null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapImageGeneration(created);
};

export const getImageGenerationForUser = async (
  userId: string,
  generationId: string,
) => {
  const [job] = await db
    .select()
    .from(imageGenerations)
    .where(
      and(
        eq(imageGenerations.id, generationId),
        eq(imageGenerations.userId, userId),
      ),
    )
    .limit(1);

  return job ? mapImageGeneration(job) : undefined;
};

export const getImageGenerationById = async (generationId: string) => {
  const [job] = await db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.id, generationId))
    .limit(1);

  return job
    ? {
        ...mapImageGeneration(job),
        userId: job.userId,
      }
    : undefined;
};

export const listImageGenerationsForUser = async (userId: string) => {
  const jobs = await db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.userId, userId))
    .orderBy(desc(imageGenerations.createdAt))
    .limit(20);

  return jobs.map(mapImageGeneration);
};

export const deleteImageGenerationForUser = async (
  userId: string,
  generationId: string,
) => {
  const [deleted] = await db
    .delete(imageGenerations)
    .where(
      and(
        eq(imageGenerations.id, generationId),
        eq(imageGenerations.userId, userId),
      ),
    )
    .returning();

  return deleted ? mapImageGeneration(deleted) : undefined;
};

export const clearTerminalImageGenerationsForUser = async (userId: string) => {
  const deleted = await db
    .delete(imageGenerations)
    .where(
      and(
        eq(imageGenerations.userId, userId),
        inArray(imageGenerations.status, ["complete", "failed"]),
      ),
    )
    .returning();

  return deleted.map(mapImageGeneration);
};

export const updateImageGenerationForUser = async ({
  userId,
  generationId,
  status,
  error,
  mediaId,
}: {
  userId: string;
  generationId: string;
  status: ImageGenerationStatus;
  error?: string | null;
  mediaId?: string | null;
}) => {
  const now = new Date();
  const [updated] = await db
    .update(imageGenerations)
    .set({
      status,
      ...(error !== undefined ? { error } : {}),
      ...(mediaId !== undefined ? { mediaId } : {}),
      ...(status === "complete" || status === "failed"
        ? { completedAt: now }
        : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(imageGenerations.id, generationId),
        eq(imageGenerations.userId, userId),
      ),
    )
    .returning();

  return updated ? mapImageGeneration(updated) : undefined;
};

export const expireStaleImageGenerationsForUser = async (
  userId: string,
  cutoff: Date,
) => {
  const now = new Date();
  const expired = await db
    .update(imageGenerations)
    .set({
      status: "failed",
      error: "Image generation exceeded the one-minute time limit.",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(imageGenerations.userId, userId),
        inArray(imageGenerations.status, activeStatuses),
        lt(imageGenerations.createdAt, cutoff),
      ),
    )
    .returning();

  return expired.map(mapImageGeneration);
};
