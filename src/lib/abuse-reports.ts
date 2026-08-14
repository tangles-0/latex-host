import { randomBytes } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import {
  abuseReports,
  albumShares,
  documentShares,
  documents,
  fileShares,
  files,
  images,
  noteShares,
  notes,
  shares,
  users,
  videoShares,
  videos,
} from "@/db/schema";
import { revokeAllApiDevicesForUser } from "@/lib/device-auth";
import { deleteMediaForUser } from "@/lib/media-store";
import type { MediaKind } from "@/lib/media-types";
import { parseShareFileName } from "@/app/share/share-route-utils";
import { isResendConfigured } from "@/lib/password-reset";

export type AbuseReportStatus = "pending" | "rejected" | "action_taken";

export type ResolvedAbuseUrl = {
  url: string;
  shareCode: string | null;
  kind: MediaKind | "album" | null;
  mediaId: string | null;
  ownerUserId: string | null;
  ownerUsername: string | null;
  ownerEmail: string | null;
  fileName: string | null;
  valid: boolean;
};

export type AbuseReportRow = {
  id: string;
  description: string;
  urls: string[];
  reporterEmail: string | null;
  status: AbuseReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
  resolvedUrls: ResolvedAbuseUrl[];
};

function newId(): string {
  return randomBytes(16).toString("hex");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Break URL-like strings so mail clients do not autolink them. */
export function neutralizeUrlForEmail(url: string): string {
  return url
    .replace(/:/g, ":\u200b")
    .replace(/\./g, ".\u200b")
    .replace(/\//g, "/\u200b");
}

export function extractSharePath(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (!parsed.pathname.startsWith("/share/")) {
      return null;
    }
    return parsed.pathname.slice("/share/".length);
  } catch {
    const trimmed = rawUrl.trim();
    const match = /\/share\/([^?#]+)/i.exec(trimmed);
    return match?.[1] ?? null;
  }
}

async function lookupShareTarget(
  fileName: string,
): Promise<Omit<ResolvedAbuseUrl, "url">> {
  const albumOnly = /^[A-Za-z0-9]+$/.exec(fileName);
  if (albumOnly) {
    const code = albumOnly[0];
    const [albumShare] = await db
      .select({
        userId: albumShares.userId,
        albumId: albumShares.albumId,
        username: users.username,
        email: users.email,
      })
      .from(albumShares)
      .innerJoin(users, eq(users.id, albumShares.userId))
      .where(eq(albumShares.code, code))
      .limit(1);
    if (albumShare) {
      return {
        shareCode: code,
        kind: "album",
        mediaId: albumShare.albumId,
        ownerUserId: albumShare.userId,
        ownerUsername: albumShare.username,
        ownerEmail: albumShare.email,
        fileName: code,
        valid: true,
      };
    }
  }

  const parsed = parseShareFileName(fileName);
  if (!parsed) {
    return {
      shareCode: null,
      kind: null,
      mediaId: null,
      ownerUserId: null,
      ownerUsername: null,
      ownerEmail: null,
      fileName: null,
      valid: false,
    };
  }

  const { code, ext } = parsed;
  const loweredExt = ext.toLowerCase();

  const [imageRow] = await db
    .select({
      mediaId: shares.imageId,
      userId: shares.userId,
      username: users.username,
      email: users.email,
      fileName: images.originalFileName,
      baseName: images.baseName,
      mediaExt: images.ext,
    })
    .from(shares)
    .innerJoin(images, eq(images.id, shares.imageId))
    .innerJoin(users, eq(users.id, shares.userId))
    .where(and(eq(shares.code, code), eq(images.ext, loweredExt)))
    .limit(1);
  if (imageRow) {
    return {
      shareCode: code,
      kind: "image",
      mediaId: imageRow.mediaId,
      ownerUserId: imageRow.userId,
      ownerUsername: imageRow.username,
      ownerEmail: imageRow.email,
      fileName: imageRow.fileName || `${imageRow.baseName}.${imageRow.mediaExt}`,
      valid: true,
    };
  }

  const [videoRow] = await db
    .select({
      mediaId: videoShares.videoId,
      userId: videoShares.userId,
      username: users.username,
      email: users.email,
      fileName: videos.originalFileName,
      baseName: videos.baseName,
      mediaExt: videos.ext,
    })
    .from(videoShares)
    .innerJoin(videos, eq(videos.id, videoShares.videoId))
    .innerJoin(users, eq(users.id, videoShares.userId))
    .where(and(eq(videoShares.code, code), eq(videos.ext, loweredExt)))
    .limit(1);
  if (videoRow) {
    return {
      shareCode: code,
      kind: "video",
      mediaId: videoRow.mediaId,
      ownerUserId: videoRow.userId,
      ownerUsername: videoRow.username,
      ownerEmail: videoRow.email,
      fileName: videoRow.fileName || `${videoRow.baseName}.${videoRow.mediaExt}`,
      valid: true,
    };
  }

  const [documentRow] = await db
    .select({
      mediaId: documentShares.documentId,
      userId: documentShares.userId,
      username: users.username,
      email: users.email,
      fileName: documents.originalFileName,
      baseName: documents.baseName,
      mediaExt: documents.ext,
    })
    .from(documentShares)
    .innerJoin(documents, eq(documents.id, documentShares.documentId))
    .innerJoin(users, eq(users.id, documentShares.userId))
    .where(and(eq(documentShares.code, code), eq(documents.ext, loweredExt)))
    .limit(1);
  if (documentRow) {
    return {
      shareCode: code,
      kind: "document",
      mediaId: documentRow.mediaId,
      ownerUserId: documentRow.userId,
      ownerUsername: documentRow.username,
      ownerEmail: documentRow.email,
      fileName:
        documentRow.fileName ||
        `${documentRow.baseName}.${documentRow.mediaExt}`,
      valid: true,
    };
  }

  const [fileRow] = await db
    .select({
      mediaId: fileShares.fileId,
      userId: fileShares.userId,
      username: users.username,
      email: users.email,
      fileName: files.originalFileName,
      baseName: files.baseName,
      mediaExt: files.ext,
    })
    .from(fileShares)
    .innerJoin(files, eq(files.id, fileShares.fileId))
    .innerJoin(users, eq(users.id, fileShares.userId))
    .where(and(eq(fileShares.code, code), eq(files.ext, loweredExt)))
    .limit(1);
  if (fileRow) {
    return {
      shareCode: code,
      kind: "other",
      mediaId: fileRow.mediaId,
      ownerUserId: fileRow.userId,
      ownerUsername: fileRow.username,
      ownerEmail: fileRow.email,
      fileName: fileRow.fileName || `${fileRow.baseName}.${fileRow.mediaExt}`,
      valid: true,
    };
  }

  if (loweredExt === "md" || loweredExt === "png") {
    const [noteRow] = await db
      .select({
        mediaId: noteShares.noteId,
        userId: noteShares.userId,
        username: users.username,
        email: users.email,
        fileName: notes.originalFileName,
        baseName: notes.baseName,
      })
      .from(noteShares)
      .innerJoin(notes, eq(notes.id, noteShares.noteId))
      .innerJoin(users, eq(users.id, noteShares.userId))
      .where(eq(noteShares.code, code))
      .limit(1);
    if (noteRow) {
      return {
        shareCode: code,
        kind: "note",
        mediaId: noteRow.mediaId,
        ownerUserId: noteRow.userId,
        ownerUsername: noteRow.username,
        ownerEmail: noteRow.email,
        fileName: noteRow.fileName || `${noteRow.baseName}.md`,
        valid: true,
      };
    }
  }

  return {
    shareCode: code,
    kind: null,
    mediaId: null,
    ownerUserId: null,
    ownerUsername: null,
    ownerEmail: null,
    fileName: null,
    valid: false,
  };
}

export async function resolveAbuseUrls(
  urls: string[],
): Promise<ResolvedAbuseUrl[]> {
  const resolved: ResolvedAbuseUrl[] = [];
  for (const url of urls) {
    const sharePath = extractSharePath(url);
    if (!sharePath) {
      resolved.push({
        url,
        shareCode: null,
        kind: null,
        mediaId: null,
        ownerUserId: null,
        ownerUsername: null,
        ownerEmail: null,
        fileName: null,
        valid: false,
      });
      continue;
    }
    const target = await lookupShareTarget(decodeURIComponent(sharePath));
    resolved.push({ url, ...target });
  }
  return resolved;
}

export async function createAbuseReport(input: {
  description: string;
  urls: string[];
  reporterEmail?: string | null;
}): Promise<{ id: string }> {
  const id = newId();
  await db.insert(abuseReports).values({
    id,
    description: input.description.slice(0, 120),
    urls: input.urls,
    reporterEmail: input.reporterEmail?.trim() || null,
    status: "pending",
    createdAt: new Date(),
  });
  return { id };
}

export async function listPendingAbuseReports(): Promise<AbuseReportRow[]> {
  const rows = await db
    .select()
    .from(abuseReports)
    .where(eq(abuseReports.status, "pending"))
    .orderBy(desc(abuseReports.createdAt));

  const reports: AbuseReportRow[] = [];
  for (const row of rows) {
    const urls = Array.isArray(row.urls) ? row.urls : [];
    reports.push({
      id: row.id,
      description: row.description,
      urls,
      reporterEmail: row.reporterEmail,
      status: row.status as AbuseReportStatus,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      resolvedByUserId: row.resolvedByUserId,
      resolutionNote: row.resolutionNote,
      resolvedUrls: await resolveAbuseUrls(urls),
    });
  }
  return reports;
}

export async function getAbuseReport(
  reportId: string,
): Promise<AbuseReportRow | null> {
  const [row] = await db
    .select()
    .from(abuseReports)
    .where(eq(abuseReports.id, reportId))
    .limit(1);
  if (!row) {
    return null;
  }
  const urls = Array.isArray(row.urls) ? row.urls : [];
  return {
    id: row.id,
    description: row.description,
    urls,
    reporterEmail: row.reporterEmail,
    status: row.status as AbuseReportStatus,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedByUserId: row.resolvedByUserId,
    resolutionNote: row.resolutionNote,
    resolvedUrls: await resolveAbuseUrls(urls),
  };
}

export async function countPendingAbuseReports(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(abuseReports)
    .where(eq(abuseReports.status, "pending"));
  return row?.count ?? 0;
}

export async function resolveAbuseReport(input: {
  reportId: string;
  adminUserId: string;
  status: "rejected" | "action_taken";
  resolutionNote?: string;
  notifyReporter: boolean;
}): Promise<AbuseReportRow | null> {
  const report = await getAbuseReport(input.reportId);
  if (!report || report.status !== "pending") {
    return null;
  }

  await db
    .update(abuseReports)
    .set({
      status: input.status,
      resolvedAt: new Date(),
      resolvedByUserId: input.adminUserId,
      resolutionNote: input.resolutionNote?.trim() || null,
    })
    .where(eq(abuseReports.id, input.reportId));

  if (input.notifyReporter && report.reporterEmail && isResendConfigured()) {
    await sendAbuseOutcomeEmail({
      to: report.reporterEmail,
      status: input.status,
      description: report.description,
    });
  }

  return getAbuseReport(input.reportId);
}

export async function banUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ bannedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.bannedAt)));
  await revokeAllApiDevicesForUser(userId);
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.bannedAt);
}

export async function deleteReportedMedia(
  targets: Array<{ userId: string; mediaId: string; kind: MediaKind }>,
): Promise<number> {
  const unique = new Map<string, { userId: string; mediaId: string; kind: MediaKind }>();
  for (const target of targets) {
    unique.set(`${target.kind}:${target.mediaId}`, target);
  }
  let deleted = 0;
  for (const target of unique.values()) {
    await deleteMediaForUser(target.userId, [
      { id: target.mediaId, kind: target.kind },
    ]);
    deleted += 1;
  }
  return deleted;
}

export async function sendAbuseReceivedEmail(input: {
  to: string;
  description: string;
  urls: string[];
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return false;
  }

  const neutralized = input.urls
    .map((url) => `<li><code style="word-break:break-all">${escapeHtml(neutralizeUrlForEmail(url))}</code></li>`)
    .join("");

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "noreply@latex.gg",
    to: input.to,
    subject: "Abuse report received — latex.gg",
    html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">
        <h1 style="font-size:20px;margin:0 0 12px">Report received</h1>
        <p style="margin:0 0 12px">Thanks for flagging this. We logged your report and will review it shortly.</p>
        <p style="margin:0 0 8px"><strong>Your description</strong></p>
        <p style="margin:0 0 16px;padding:12px;background:#f5f5f5;border-radius:6px">${escapeHtml(input.description)}</p>
        <p style="margin:0 0 8px"><strong>Reported locations</strong> (deliberately broken so your mail client will not open them)</p>
        <ul style="margin:0 0 16px;padding-left:18px">${neutralized}</ul>
        <p style="margin:0;color:#666;font-size:13px">If you opted in for an outcome email, we will write again after review.</p>
      </div>
    `,
  });
  return true;
}

export async function sendAbuseOutcomeEmail(input: {
  to: string;
  status: "rejected" | "action_taken";
  description: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return false;
  }

  const headline =
    input.status === "action_taken"
      ? "Action was taken on your abuse report"
      : "Update on your abuse report";
  const body =
    input.status === "action_taken"
      ? "We reviewed your report and removed or restricted the reported material."
      : "We reviewed your report and determined no further action was needed at this time.";

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "noreply@latex.gg",
    to: input.to,
    subject: `${headline} — latex.gg`,
    html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">
        <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(headline)}</h1>
        <p style="margin:0 0 12px">${escapeHtml(body)}</p>
        <p style="margin:0 0 8px"><strong>Original description</strong></p>
        <p style="margin:0;padding:12px;background:#f5f5f5;border-radius:6px">${escapeHtml(input.description)}</p>
      </div>
    `,
  });
  return true;
}
