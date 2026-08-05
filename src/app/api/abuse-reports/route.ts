import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { z } from "zod";
import {
  createAbuseReport,
  sendAbuseReceivedEmail,
} from "@/lib/abuse-reports";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

const bodySchema = z.object({
  description: z.string().trim().min(1).max(120),
  urls: z.array(z.string().trim().url().max(2048)).min(1).max(20),
  email: z.string().trim().max(320).optional(),
  turnstileToken: z.string().trim().optional(),
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request): Promise<NextResponse> {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const ip = clientIp(request);
  const rate = await consumeRequestRateLimit({
    namespace: "abuse-report",
    key: ip,
    limit: 2,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many reports. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const captcha = await verifyTurnstileToken({
    token: parsed.data.turnstileToken ?? "",
    remoteIp: ip,
  });
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  const urls = [...new Set(parsed.data.urls.map((url) => url.trim()))];
  const emailRaw = parsed.data.email?.trim() || "";
  if (emailRaw && !z.string().email().safeParse(emailRaw).success) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400 },
    );
  }
  const email = emailRaw || null;

  const created = await createAbuseReport({
    description: parsed.data.description,
    urls,
    reporterEmail: email,
  });

  if (email) {
    try {
      await sendAbuseReceivedEmail({
        to: email,
        description: parsed.data.description,
        urls,
      });
    } catch {
      // Report is stored even if confirmation email fails.
    }
  }

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
