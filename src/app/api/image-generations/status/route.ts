import { NextResponse } from "next/server";

import { applyQueuedImageGenerationUpdates } from "@/lib/image-generations/repository";
import { queuedImageGenerationBatchSchema } from "@/lib/image-generations/types";
import { isWorkerIngestAuthorized } from "@/lib/preview-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = queuedImageGenerationBatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid queue status payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = await applyQueuedImageGenerationUpdates(
    parsed.data.map((job) => ({
      id: job.id,
      position: job.position,
    })),
  );

  return NextResponse.json({
    updated: updated.length,
  });
};
