import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { registerMediaFromPublicUpload } from "@/lib/api-v1/media-register";
import { getShareForUserByMedia } from "@/lib/media-store";
import { getAlbumForUser } from "@/lib/metadata-store";
import { headPublicBlob, isPublicBlobConfigured } from "@/lib/public-blob";
import { buildPublicShareUrls } from "@/lib/public-share-urls";
import {
  getUploadSessionForUser,
  markPublicUploadSessionComplete,
  parsePublicSessionMetadata,
} from "@/lib/upload-sessions";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isPublicBlobConfigured()) {
    return NextResponse.json(
      { error: "Public uploads are not available." },
      { status: 400 },
    );
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const payload = (await request.json()) as {
    sessionId?: string;
    url?: string;
    pathname?: string;
    albumId?: string;
    keepOriginalFileName?: boolean;
  };
  const sessionId = payload.sessionId?.trim() ?? "";
  const publicBlobUrl = payload.url?.trim() ?? "";
  const albumId = payload.albumId?.trim() || undefined;
  if (!sessionId || !publicBlobUrl) {
    return NextResponse.json(
      { error: "sessionId and url are required." },
      { status: 400 },
    );
  }
  if (albumId) {
    const album = await getAlbumForUser(albumId, userId);
    if (!album) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
  }

  const session = await getUploadSessionForUser(sessionId, userId);
  if (!session || session.backend !== "public-blob" || !session.storageKey) {
    return NextResponse.json(
      { error: "Public upload session not found." },
      { status: 404 },
    );
  }
  const metadata = parsePublicSessionMetadata(session.s3UploadId);
  if (!metadata) {
    return NextResponse.json(
      { error: "Public upload session is missing its reserved path." },
      { status: 409 },
    );
  }
  if (payload.pathname && payload.pathname !== session.storageKey) {
    return NextResponse.json(
      { error: "Uploaded path does not match the session." },
      { status: 409 },
    );
  }

  try {
    const head = await headPublicBlob(session.storageKey);
    if (Number(head.size ?? 0) !== session.fileSize) {
      return NextResponse.json(
        { error: "Uploaded file size does not match the declared file size." },
        { status: 409 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Public upload was not found in the public store." },
      { status: 409 },
    );
  }

  if (session.state === "complete") {
    return NextResponse.json(
      { error: "Public upload session is already registered." },
      { status: 409 },
    );
  }

  const media = await registerMediaFromPublicUpload({
    request,
    userId,
    session: {
      storageKey: session.storageKey,
      fileName: session.fileName,
      fileSize: session.fileSize,
      mimeType: session.mimeType,
      ext: session.ext,
      baseName: metadata.baseName,
      uploadedAt: session.createdAt,
    },
    publicBlobUrl,
    albumId,
    keepOriginalFileName: payload.keepOriginalFileName,
  });
  await markPublicUploadSessionComplete(session);

  const share = await getShareForUserByMedia(media.kind, media.id, userId);

  return NextResponse.json({
    media: {
      ...media,
      shared: Boolean(share?.code),
    },
    urls: share?.code
      ? await buildPublicShareUrls(media.kind, share.code, media.ext)
      : undefined,
  });
}
