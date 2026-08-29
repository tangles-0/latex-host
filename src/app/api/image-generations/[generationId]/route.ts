import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth";
import {
  deleteImageGenerationForUser,
  getImageGenerationForUser,
} from "@/lib/image-generations/repository";
import { deleteMediaForUser } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) => {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { generationId } = await params;
  const action = new URL(request.url).searchParams.get("action");
  if (action !== "keep" && action !== "discard") {
    return NextResponse.json(
      { error: "action must be keep or discard." },
      { status: 400 },
    );
  }

  const generation = await getImageGenerationForUser(userId, generationId);
  if (!generation) {
    return NextResponse.json(
      { error: "Image generation not found." },
      { status: 404 },
    );
  }
  if (generation.status !== "complete" && generation.status !== "failed") {
    return NextResponse.json(
      { error: "Active image generations cannot be removed." },
      { status: 409 },
    );
  }
  if (action === "keep" && generation.status !== "complete") {
    return NextResponse.json(
      { error: "Only completed images can be kept." },
      { status: 409 },
    );
  }

  if (action === "discard" && generation.mediaId) {
    await deleteMediaForUser(userId, [
      { id: generation.mediaId, kind: "image" },
    ]);
  }
  await deleteImageGenerationForUser(userId, generationId);

  return NextResponse.json({ ok: true });
};
