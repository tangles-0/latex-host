import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth";
import { canUserGenerateImages } from "@/lib/image-generations/access";
import {
  decodeImageGenerationMask,
  isImg2ImgSourceExtension,
} from "@/lib/image-generations/img2img";
import {
  clearTerminalImageGenerationsForUser,
  createImageGenerationForUser,
  expireStaleImageGenerationsForUser,
  listImageGenerationsForUser,
  updateImageGenerationForUser,
} from "@/lib/image-generations/repository";
import { imageGenerationJobSafetyMaxAgeMs } from "@/lib/image-generations/policy";
import {
  imageGenerationInputSchema,
  type ImageGenerationEntry,
} from "@/lib/image-generations/types";
import { getMediaForUser } from "@/lib/media-store";
import {
  getAppSettings,
  getGroupLimits,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import {
  buildAppUrl,
  requestImageGeneration,
  requestImageGenerationStatus,
} from "@/lib/preview-worker";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { isAllowedUploadType } from "@/lib/upload-allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mediaUrls = (
  media: NonNullable<Awaited<ReturnType<typeof getMediaForUser>>>,
) => ({
  thumbnailUrl: `/media/image/${media.id}/${media.baseName}-sm.${media.ext}`,
  imageUrl: `/media/image/${media.id}/${media.baseName}.${media.ext}`,
});

const withThumbnail = async (
  userId: string,
  generation: ImageGenerationEntry,
) => {
  const [output, source] = await Promise.all([
    generation.mediaId
      ? getMediaForUser("image", generation.mediaId, userId)
      : Promise.resolve(undefined),
    generation.sourceMediaId
      ? getMediaForUser("image", generation.sourceMediaId, userId)
      : Promise.resolve(undefined),
  ]);

  return {
    ...generation,
    ...(output ? mediaUrls(output) : {}),
    ...(source ? { sourceThumbnailUrl: mediaUrls(source).thumbnailUrl } : {}),
  };
};

export const GET = async () => {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [existing, hasAccess] = await Promise.all([
    listImageGenerationsForUser(userId),
    canUserGenerateImages(userId),
  ]);
  const active = existing.filter(
    (generation) =>
      generation.status === "pending" ||
      generation.status === "generating" ||
      generation.status === "uploading",
  );

  await Promise.all(
    active.map(async (generation) => {
      const workerStatus = await requestImageGenerationStatus(generation.id);
      if (!workerStatus.ok) {
        return;
      }

      await updateImageGenerationForUser({
        userId,
        generationId: generation.id,
        status: workerStatus.generation.status,
        error: workerStatus.generation.error ?? null,
        ...(workerStatus.generation.mediaId
          ? { mediaId: workerStatus.generation.mediaId }
          : {}),
      });
    }),
  );

  await expireStaleImageGenerationsForUser(
    userId,
    new Date(Date.now() - imageGenerationJobSafetyMaxAgeMs),
  );
  const generations = await listImageGenerationsForUser(userId);
  return NextResponse.json({
    hasAccess,
    generations: await Promise.all(
      generations.map((generation) => withThumbnail(userId, generation)),
    ),
  });
};

export const POST = async (request: Request) => {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = imageGenerationInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid image generation request.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const [settings, groupInfo] = await Promise.all([
    getAppSettings(),
    getUserGroupInfo(userId),
  ]);
  if (!settings.uploadsEnabled) {
    return NextResponse.json(
      { error: "Uploads are currently disabled." },
      { status: 403 },
    );
  }
  const limits = await getGroupLimits(groupInfo.groupId);
  if (!limits.imageGenerationEnabled) {
    return NextResponse.json(
      {
        error: "you do not have access to image generation - please request it",
      },
      { status: 403 },
    );
  }
  if (
    !isAllowedUploadType({
      allowed: limits.allowedTypes,
      mimeType: "image/png",
      ext: "png",
    })
  ) {
    return NextResponse.json(
      { error: "PNG image uploads are not allowed for this account." },
      { status: 415 },
    );
  }

  let sourceMedia: Awaited<ReturnType<typeof getMediaForUser>> | undefined;
  let maskPngBase64: string | undefined;
  if (parsed.data.sourceMediaId) {
    sourceMedia = await getMediaForUser(
      "image",
      parsed.data.sourceMediaId,
      userId,
    );
    if (!sourceMedia) {
      return NextResponse.json(
        { error: "Source image not found." },
        { status: 404 },
      );
    }
    if (!isImg2ImgSourceExtension(sourceMedia.ext)) {
      return NextResponse.json(
        { error: "That image format cannot be used for image-to-image." },
        { status: 415 },
      );
    }
  }
  if (parsed.data.maskPngBase64) {
    try {
      maskPngBase64 = decodeImageGenerationMask(parsed.data.maskPngBase64).encoded;
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Mask image is invalid.",
        },
        { status: 400 },
      );
    }
  }

  const rate = await consumeRequestRateLimit({
    namespace: "image-generation",
    key: userId,
    limit: 5,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many image generation requests. Please retry shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const generation = await createImageGenerationForUser(userId, parsed.data);
  const queued = await requestImageGeneration({
    generationId: generation.id,
    userId,
    prompt: generation.prompt,
    negativePrompt: generation.negativePrompt,
    expandPrompt: generation.expandPrompt,
    ...(sourceMedia
      ? {
          sourceMediaId: sourceMedia.id,
          sourceDownloadUrl: buildAppUrl(
            request,
            `/api/thumbnails/${sourceMedia.id}/source`,
          ),
          sourceMimeType: sourceMedia.mimeType,
          denoisingStrength: generation.denoisingStrength,
        }
      : {}),
    ...(maskPngBase64 ? { maskPngBase64 } : {}),
  });

  if (!queued.ok) {
    const failed = await updateImageGenerationForUser({
      userId,
      generationId: generation.id,
      status: "failed",
      error: queued.error,
    });
    return NextResponse.json(
      { error: queued.error, generation: failed },
      { status: 502 },
    );
  }

  return NextResponse.json({ generation }, { status: 202 });
};

export const DELETE = async () => {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cleared = await clearTerminalImageGenerationsForUser(userId);
  return NextResponse.json({ clearedCount: cleared.length });
};
