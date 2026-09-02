import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth";
import { cancelNodeImportJob, retryNodeImportJob } from "@/lib/node-imports";
import { isNodeMode } from "@/lib/self-hosted-nodes";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const { jobId } = await params;
  if (!(await cancelNodeImportJob(jobId, userId))) {
    return NextResponse.json(
      { error: "Active import not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const { jobId } = await params;
  if (!(await retryNodeImportJob(jobId, userId))) {
    return NextResponse.json(
      { error: "Retryable import not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
