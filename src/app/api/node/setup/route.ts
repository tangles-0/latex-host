import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getOrCreateNodeInstanceSettings,
  isNodeMode,
  normalizePublicHttpsUrl,
  saveLinkedNodeInstance,
} from "@/lib/self-hosted-nodes";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

const setupSchema = z.object({
  linkCode: z.string().min(8).max(32),
  publicHttpsUrl: z.string().url().max(2048),
});

const cloudReachability = async (cloudBaseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(
      new URL("/api/nodes/connectivity", cloudBaseUrl),
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
};

export async function GET(): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const settings = await getOrCreateNodeInstanceSettings();
  return NextResponse.json({
    isLinked: Boolean(settings.nodeHash && settings.authSecret),
    nodeHash: settings.nodeHash,
    publicHttpsUrl: settings.publicHttpsUrl,
    cloudBaseUrl: settings.cloudBaseUrl,
    isLatexReachable: await cloudReachability(settings.cloudBaseUrl),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid HTTPS URL and link code." },
      { status: 400 },
    );
  }
  let publicHttpsUrl: string;
  try {
    publicHttpsUrl = normalizePublicHttpsUrl(parsed.data.publicHttpsUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid public URL." },
      { status: 400 },
    );
  }
  const settings = await getOrCreateNodeInstanceSettings();
  if (settings.nodeHash && settings.authSecret) {
    return NextResponse.json(
      { error: "This node is already linked." },
      { status: 409 },
    );
  }
  try {
    const response = await fetch(
      new URL("/api/nodes/register", settings.cloudBaseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkCode: parsed.data.linkCode,
          publicHttpsUrl,
          setupChallenge: settings.setupChallenge,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      nodeHash?: string;
      authSecret?: string;
      cloudAccessSecret?: string;
      status?: string;
      isForwardingEnabled?: boolean;
      error?: string;
    };
    if (
      !response.ok ||
      !payload.nodeHash ||
      !payload.authSecret ||
      !payload.cloudAccessSecret
    ) {
      throw new Error(
        payload.error ?? "latex.gg rejected the node registration.",
      );
    }
    await saveLinkedNodeInstance({
      publicHttpsUrl,
      nodeHash: payload.nodeHash,
      authSecret: payload.authSecret,
      cloudAccessSecret: payload.cloudAccessSecret,
    });
    return NextResponse.json({
      isLinked: true,
      nodeHash: payload.nodeHash,
      status: payload.status,
      isForwardingEnabled: payload.isForwardingEnabled,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to reach latex.gg.",
      },
      { status: 400 },
    );
  }
}
