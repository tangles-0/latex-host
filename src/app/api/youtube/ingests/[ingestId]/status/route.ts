import { NextResponse } from "next/server";
import { isWorkerIngestAuthorized } from "@/lib/preview-worker";
import {
  getYoutubeIngest,
  updateYoutubeIngest,
  type YoutubeIngestStatus,
} from "@/lib/youtube-ingests";

export const runtime = "nodejs";

function parseStatus(value: string | undefined): YoutubeIngestStatus | null {
  if (
    value === "pending" ||
    value === "started" ||
    value === "downloading" ||
    value === "uploading" ||
    value === "complete" ||
    value === "error"
  ) {
    return value;
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ingestId: string }> },
): Promise<NextResponse> {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { ingestId } = await params;
  const ingest = await getYoutubeIngest(ingestId);
  if (!ingest) {
    return NextResponse.json(
      { error: "YouTube ingest not found." },
      { status: 404 },
    );
  }

  const payload = (await request.json()) as {
    status?: string;
    progress?: number;
    error?: string;
    mediaId?: string;
  };
  const status = parseStatus(payload.status);
  if (!status) {
    return NextResponse.json(
      { error: "Valid status is required." },
      { status: 400 },
    );
  }

  const updated = await updateYoutubeIngest({
    ingestId,
    status,
    progress:
      status === "complete" ? 100 : Number(payload.progress ?? ingest.progress),
    error:
      status === "error"
        ? payload.error?.slice(0, 500) || "YouTube ingest failed."
        : null,
    mediaId: payload.mediaId ?? ingest.mediaId,
  });
  return NextResponse.json({ ok: true, ingest: updated });
}
