import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import {
  banUser,
  deleteReportedMedia,
  getAbuseReport,
  resolveAbuseReport,
} from "@/lib/abuse-reports";
import type { MediaKind } from "@/lib/media-types";
import { isAdminUser } from "@/lib/metadata-store";

export const runtime = "nodejs";

const patchSchema = z.object({
  action: z.enum(["reject", "action_taken", "ban_user", "delete_files"]),
  notifyReporter: z.boolean().optional(),
  userId: z.string().min(1).optional(),
  mediaItems: z
    .array(
      z.object({
        userId: z.string().min(1),
        mediaId: z.string().min(1),
        kind: z.enum(["image", "video", "document", "other", "note"]),
      }),
    )
    .optional(),
  resolutionNote: z.string().trim().max(500).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { reportId } = await params;
  const report = await getAbuseReport(reportId);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  return NextResponse.json({ report });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<NextResponse> {
  const adminUserId = await getSessionUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await isAdminUser(adminUserId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { reportId } = await params;
  const report = await getAbuseReport(reportId);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  if (report.status !== "pending") {
    return NextResponse.json(
      { error: "Report already resolved." },
      { status: 409 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action payload." },
      { status: 400 },
    );
  }

  const notifyReporter = Boolean(parsed.data.notifyReporter);

  if (parsed.data.action === "ban_user") {
    const targetUserId = parsed.data.userId;
    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId is required to ban." },
        { status: 400 },
      );
    }
    await banUser(targetUserId);
    return NextResponse.json({ ok: true, bannedUserId: targetUserId });
  }

  if (parsed.data.action === "delete_files") {
    const items = parsed.data.mediaItems ?? [];
    if (items.length === 0) {
      return NextResponse.json(
        { error: "mediaItems are required to delete files." },
        { status: 400 },
      );
    }
    const deleted = await deleteReportedMedia(
      items.map((item) => ({
        userId: item.userId,
        mediaId: item.mediaId,
        kind: item.kind as MediaKind,
      })),
    );
    return NextResponse.json({ ok: true, deleted });
  }

  const status =
    parsed.data.action === "reject" ? "rejected" : "action_taken";
  const updated = await resolveAbuseReport({
    reportId,
    adminUserId,
    status,
    resolutionNote: parsed.data.resolutionNote,
    notifyReporter,
  });

  return NextResponse.json({ ok: true, report: updated });
}
