import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  countPendingAbuseReports,
  listPendingAbuseReports,
} from "@/lib/abuse-reports";
import { isAdminUser } from "@/lib/metadata-store";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [reports, pendingCount] = await Promise.all([
    listPendingAbuseReports(),
    countPendingAbuseReports(),
  ]);

  return NextResponse.json({ reports, pendingCount });
}
