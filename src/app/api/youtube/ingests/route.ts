import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  createYoutubeIngestForUser,
  deleteYoutubeIngestForUser,
  listYoutubeIngestsForUser,
} from "@/lib/youtube-ingests";
import {
  getGroupLimits,
  getMaxAllowedBytesForKind,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import { buildAppUrl, requestYoutubeDownload } from "@/lib/preview-worker";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ingests = await listYoutubeIngestsForUser(userId);
  return NextResponse.json({ ingests });
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    youtubeUrl?: string;
    youtubeId?: string;
    title?: string;
    channelName?: string;
    durationSeconds?: number;
    qualityId?: string;
    qualityLabel?: string;
    filesizeBytes?: number;
    outputType?: "video" | "audio";
  };
  const youtubeUrl = payload.youtubeUrl?.trim() ?? "";
  const youtubeId = payload.youtubeId?.trim() ?? "";
  const title = payload.title?.trim() ?? "";
  const qualityId = payload.qualityId?.trim() ?? "";
  const outputType = payload.outputType === "audio" ? "audio" : "video";
  if (
    !youtubeUrl ||
    !youtubeId ||
    !title ||
    (outputType === "video" && !qualityId)
  ) {
    return NextResponse.json(
      {
        error:
          "youtubeUrl, youtubeId, and title are required; video ingests also require qualityId.",
      },
      { status: 400 },
    );
  }

  const groupInfo = await getUserGroupInfo(userId);
  const limits = await getGroupLimits(groupInfo.groupId);
  const maxUploadSizeBytes = getMaxAllowedBytesForKind(
    limits,
    outputType === "audio" ? "other" : "video",
  );
  const filesizeBytes = Number(payload.filesizeBytes ?? 0);
  if (Number.isFinite(filesizeBytes) && filesizeBytes > maxUploadSizeBytes) {
    return NextResponse.json(
      {
        error: "Selected YouTube format exceeds your upload size limit.",
        maxUploadSizeBytes,
      },
      { status: 413 },
    );
  }

  const ingest = await createYoutubeIngestForUser({
    userId,
    youtubeId,
    youtubeUrl,
    title,
    channelName: payload.channelName?.trim() || undefined,
    durationSeconds: Number.isFinite(payload.durationSeconds)
      ? Number(payload.durationSeconds)
      : undefined,
    qualityLabel:
      outputType === "audio"
        ? "MP3 (highest quality)"
        : payload.qualityLabel?.trim() || qualityId,
    outputType,
  });
  const started = await requestYoutubeDownload({
    ingestId: ingest.id,
    userId,
    youtubeId,
    outputType,
    ...(outputType === "video" ? { qualityId } : {}),
    statusUrl: buildAppUrl(request, `/api/youtube/ingests/${ingest.id}/status`),
    uploadInitUrl: buildAppUrl(request, "/api/uploads/init"),
    uploadPartUrl: buildAppUrl(request, "/api/uploads/part"),
    uploadCompleteUrl: buildAppUrl(request, "/api/uploads/complete"),
  });
  if (!started.ok) {
    await deleteYoutubeIngestForUser(userId, ingest.id);
    return NextResponse.json({ error: started.error }, { status: 502 });
  }

  return NextResponse.json({ ingest });
}
