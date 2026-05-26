import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  getGroupLimits,
  getMaxAllowedBytesForKind,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import { requestYoutubeMetadata } from "@/lib/preview-worker";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as { url?: string };
  const youtubeUrl = payload.url?.trim() ?? "";
  if (!youtubeUrl) {
    return NextResponse.json(
      { error: "YouTube URL is required." },
      { status: 400 },
    );
  }

  const [metadata, groupInfo] = await Promise.all([
    requestYoutubeMetadata(youtubeUrl),
    getUserGroupInfo(userId),
  ]);
  if (!metadata.ok) {
    return NextResponse.json({ error: metadata.error }, { status: 502 });
  }
  const limits = await getGroupLimits(groupInfo.groupId);
  return NextResponse.json({
    metadata: metadata.metadata,
    maxVideoSizeBytes: getMaxAllowedBytesForKind(limits, "video"),
  });
}
