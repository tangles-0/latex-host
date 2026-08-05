import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  getGroupLimits,
  getUserGroupInfo,
  isAdminUser,
} from "@/lib/metadata-store";
import {
  getMedia,
  getMediaForUser,
  updateDocumentContentMetadataForUser,
} from "@/lib/media-store";
import {
  isEditableTextDocument,
  MAX_EDITABLE_TEXT_DOCUMENT_BYTES,
} from "@/lib/media-types";
import {
  getMediaBuffer,
  overwriteTextDocumentContent,
} from "@/lib/media-storage";

export const runtime = "nodejs";

function parseDocumentId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("mediaId")?.trim() ?? "";
}

async function resolveEditableDocument(input: {
  userId: string;
  mediaId: string;
}): Promise<
  | { ok: true; media: NonNullable<Awaited<ReturnType<typeof getMediaForUser>>> }
  | { ok: false; response: NextResponse }
> {
  let media = await getMediaForUser("document", input.mediaId, input.userId);
  if (!media && (await isAdminUser(input.userId))) {
    media = await getMedia("document", input.mediaId);
  }
  if (!media || media.kind !== "document") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Document not found." }, { status: 404 }),
    };
  }
  if (!isEditableTextDocument(media.mimeType ?? "", media.ext)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This document type cannot be edited in the gallery." },
        { status: 400 },
      ),
    };
  }
  return { ok: true, media };
}

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const mediaId = parseDocumentId(request);
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required." }, { status: 400 });
  }

  const resolved = await resolveEditableDocument({ userId, mediaId });
  if (!resolved.ok) {
    return resolved.response;
  }
  const { media } = resolved;

  if ((media.sizeOriginal ?? 0) > MAX_EDITABLE_TEXT_DOCUMENT_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large to edit in the browser (max ${MAX_EDITABLE_TEXT_DOCUMENT_BYTES} bytes).`,
      },
      { status: 413 },
    );
  }

  try {
    const buffer = await getMediaBuffer({
      kind: "document",
      baseName: media.baseName,
      ext: media.ext,
      size: "original",
      uploadedAt: new Date(media.uploadedAt),
    });
    return NextResponse.json({
      content: buffer.toString("utf8"),
      media,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to read document content." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    mediaId?: string;
    content?: string;
  };
  const mediaId =
    typeof payload.mediaId === "string" ? payload.mediaId.trim() : "";
  const content = typeof payload.content === "string" ? payload.content : "";
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required." }, { status: 400 });
  }

  const contentBytes = Buffer.byteLength(content, "utf8");
  if (contentBytes > MAX_EDITABLE_TEXT_DOCUMENT_BYTES) {
    return NextResponse.json(
      {
        error: `Content exceeds in-browser edit limit (${MAX_EDITABLE_TEXT_DOCUMENT_BYTES} bytes).`,
      },
      { status: 413 },
    );
  }

  const groupInfo = await getUserGroupInfo(userId);
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  if (contentBytes > groupLimits.maxDocumentSize) {
    return NextResponse.json(
      { error: "Document exceeds size limit." },
      { status: 413 },
    );
  }

  const owned = await getMediaForUser("document", mediaId, userId);
  if (!owned || owned.kind !== "document") {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (!isEditableTextDocument(owned.mimeType ?? "", owned.ext)) {
    return NextResponse.json(
      { error: "This document type cannot be edited in the gallery." },
      { status: 400 },
    );
  }

  try {
    const stored = await overwriteTextDocumentContent({
      baseName: owned.baseName,
      ext: owned.ext,
      mimeType: owned.mimeType ?? "text/plain",
      uploadedAt: new Date(owned.uploadedAt),
      content,
    });
    const media = await updateDocumentContentMetadataForUser({
      userId,
      mediaId,
      sizeOriginal: stored.sizeOriginal,
      sizeSm: stored.sizeSm,
      sizeLg: stored.sizeLg,
      previewStatus: stored.previewStatus,
      previewError:
        stored.previewStatus === "error"
          ? "Unable to regenerate preview."
          : null,
    });
    if (!media) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return NextResponse.json({ content, media });
  } catch {
    return NextResponse.json(
      { error: "Unable to save document content." },
      { status: 500 },
    );
  }
}
