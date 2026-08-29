import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getImageGenerationById,
  updateImageGenerationForUser,
} from "@/lib/image-generations/repository";
import { isWorkerIngestAuthorized } from "@/lib/preview-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusPayloadSchema = z.object({
  status: z.enum(["generating", "uploading", "complete", "failed"]),
  error: z.string().max(4000).optional(),
});

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) => {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { generationId } = await params;
  const parsed = statusPayloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const generation = await getImageGenerationById(generationId);
  if (!generation) {
    return NextResponse.json(
      { error: "Image generation not found." },
      { status: 404 },
    );
  }

  if (generation.status === "complete" || generation.status === "failed") {
    return NextResponse.json({ generation });
  }

  if (parsed.data.status === "complete" && !generation.mediaId) {
    return NextResponse.json(
      { error: "Generated image has not been uploaded." },
      { status: 409 },
    );
  }

  const updated = await updateImageGenerationForUser({
    userId: generation.userId,
    generationId,
    status: parsed.data.status,
    error:
      parsed.data.status === "failed"
        ? (parsed.data.error ?? "Image generation failed.")
        : null,
  });

  return NextResponse.json({ generation: updated });
};
