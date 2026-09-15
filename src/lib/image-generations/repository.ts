import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { imageGenerations } from "@/db/schema";
import {
  denoisingPercentToStrength,
  denoisingStrengthToPercent,
} from "@/lib/image-generations/img2img";
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
  expandPrompt: row.expandPrompt,
  sourceMediaId: row.sourceMediaId ?? undefined,
  denoisingStrength:
    row.denoisingStrength == null
      ? undefined
      : denoisingPercentToStrength(row.denoisingStrength),
  hasMask: row.hasMask,
  status: row.status as ImageGenerationStatus,
  queuePosition: row.queuePosition ?? undefined,
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
      expandPrompt: input.expandPrompt,
      sourceMediaId: input.sourceMediaId || null,
      denoisingStrength:
        input.denoisingStrength == null
          ? null
          : denoisingStrengthToPercent(input.denoisingStrength),
      hasMask: Boolean(input.maskPngBase64),
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
        inArray(imageGenerations.status, ["complete", "failed", "cancelled"]),
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
  queuePosition,
}: {
  userId: string;
  generationId: string;
  status: ImageGenerationStatus;
  error?: string | null;
  mediaId?: string | null;
  queuePosition?: number | null;
}) => {
  const now = new Date();
  const [updated] = await db
    .update(imageGenerations)
    .set({
      status,
      ...(error !== undefined ? { error } : {}),
      ...(mediaId !== undefined ? { mediaId } : {}),
      ...(status === "pending" && queuePosition !== undefined
        ? { queuePosition }
        : {}),
      ...(status === "complete" ||
      status === "failed" ||
      status === "cancelled"
        ? { completedAt: now }
        : {}),
      ...(status !== "pending" ? { queuePosition: null } : {}),
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

export const applyQueuedImageGenerationUpdates = async (
  updates: Array<{ id: string; position: number }>,
) => {
  if (updates.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const updated: ImageGenerationEntry[] = [];

    for (const update of updates) {
      const [row] = await tx
        .update(imageGenerations)
        .set({
          queuePosition: update.position,
          error: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(imageGenerations.id, update.id),
            eq(imageGenerations.status, "pending"),
          ),
        )
        .returning();

      if (row) {
        updated.push(mapImageGeneration(row));
      }
    }

    return updated;
  });
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
      error: "Image generation did not complete in time.",
      completedAt: now,
      updatedAt: now,
      queuePosition: null,
    })
    .where(
      and(
        eq(imageGenerations.userId, userId),
        inArray(imageGenerations.status, activeStatuses),
        lt(imageGenerations.updatedAt, cutoff),
      ),
    )
    .returning();

  return expired.map(mapImageGeneration);
};
