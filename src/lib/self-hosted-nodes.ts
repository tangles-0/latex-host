import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  nodeInstanceSettings,
  nodeLoginCodes,
  selfHostedNodes,
  users,
} from "@/db/schema";
import { generateUniqueNodeHash, randomShareCode } from "@/lib/share-code";

const NODE_INSTANCE_ID = "primary";
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;
const LOGIN_CODE_TTL_MS = 5 * 60 * 1000;
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const PROBE_TIMEOUT_MS = 10_000;

export type SelfHostedNodeStatus = "not_linked" | "not_reachable" | "ok";

export type SelfHostedNodeSummary = {
  id: string;
  nodeHash: string | null;
  publicHttpsUrl: string | null;
  status: SelfHostedNodeStatus;
  isForwardingEnabled: boolean;
  isOwnerDisabled: boolean;
  lastPingAt: string | null;
  lastReachabilityAt: string | null;
  createdAt: string;
};

const hashToken = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const normalizeLinkCode = (value: string): string =>
  value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const formatLinkCode = (value: string): string =>
  value.match(/.{1,4}/g)?.join("-") ?? value;

const safeTokenMatch = (plainText: string, expectedHash: string): boolean => {
  const actual = Buffer.from(hashToken(plainText), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const isNodeMode = (): boolean => process.env.NODE_MODE === "true";

export const getLatexCloudBaseUrl = (): string => {
  const configured = process.env.LATEX_CLOUD_URL?.trim() || "https://latex.gg";
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("LATEX_CLOUD_URL must use HTTPS.");
  }
  return parsed.origin;
};

const isPrivateIpv4 = (address: string): boolean => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
};

export const isPublicIpAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) {
    return !isPrivateIpv4(address);
  }
  if (family !== 6) {
    return false;
  }
  const normalized = address.toLowerCase();
  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:192.168.")
  );
};

export const normalizePublicHttpsUrl = (value: string): string => {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("The node public URL must use HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      "The node public URL cannot contain credentials, a query, or a fragment.",
    );
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error("The node public URL must be an origin without a path.");
  }
  if (
    parsed.hostname === "localhost" ||
    parsed.hostname.endsWith(".localhost") ||
    parsed.hostname.endsWith(".local")
  ) {
    throw new Error("The node public URL must use public DNS.");
  }
  return parsed.origin;
};

const assertPublicDns = async (publicHttpsUrl: string): Promise<void> => {
  const hostname = new URL(publicHttpsUrl).hostname;
  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("The node public URL cannot target a private address.");
    }
    return;
  }
  const addresses = await lookup(hostname, { all: true });
  if (
    addresses.length === 0 ||
    addresses.some((result) => !isPublicIpAddress(result.address))
  ) {
    throw new Error(
      "The node public URL must resolve only to public addresses.",
    );
  }
};

export const isSafePublicNodeUrl = async (
  publicHttpsUrl: string,
): Promise<boolean> => {
  try {
    normalizePublicHttpsUrl(publicHttpsUrl);
    await assertPublicDns(publicHttpsUrl);
    return true;
  } catch {
    return false;
  }
};

export const probeNodeReachability = async (
  publicHttpsUrl: string,
  challenge: string,
): Promise<boolean> => {
  try {
    await assertPublicDns(publicHttpsUrl);
    const url = new URL("/api/node/health", publicHttpsUrl);
    url.searchParams.set("challenge", challenge);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return false;
    }
    const payload = (await response.json()) as { challenge?: unknown };
    return payload.challenge === challenge;
  } catch {
    return false;
  }
};

export const createSelfHostedNode = async (
  userId: string,
): Promise<{ node: SelfHostedNodeSummary; linkCode: string }> => {
  const rawLinkCode = randomShareCode(12).toUpperCase();
  const now = new Date();
  const [row] = await db
    .insert(selfHostedNodes)
    .values({
      id: randomUUID(),
      userId,
      linkCodeHash: hashToken(rawLinkCode),
      linkCodeExpiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS),
      status: "not_linked",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return {
    node: mapNodeSummary(row),
    linkCode: formatLinkCode(rawLinkCode),
  };
};

const effectiveStatus = (
  row: typeof selfHostedNodes.$inferSelect,
): SelfHostedNodeStatus => {
  if (!row.nodeHash) {
    return "not_linked";
  }
  if (!row.lastPingAt || Date.now() - row.lastPingAt.getTime() > ONE_HOUR_MS) {
    return "not_reachable";
  }
  return row.status === "ok" ? "ok" : "not_reachable";
};

const mapNodeSummary = (
  row: typeof selfHostedNodes.$inferSelect,
): SelfHostedNodeSummary => ({
  id: row.id,
  nodeHash: row.nodeHash,
  publicHttpsUrl: row.publicHttpsUrl,
  status: effectiveStatus(row),
  isForwardingEnabled: row.forwardingEnabled,
  isOwnerDisabled: row.isOwnerDisabled,
  lastPingAt: row.lastPingAt?.toISOString() ?? null,
  lastReachabilityAt: row.lastReachabilityAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export const listSelfHostedNodes = async (
  userId: string,
): Promise<SelfHostedNodeSummary[]> => {
  const rows = await db
    .select()
    .from(selfHostedNodes)
    .where(eq(selfHostedNodes.userId, userId));
  return rows.map(mapNodeSummary);
};

export const getSelfHostedNodeForUser = async (
  nodeHash: string,
  userId: string,
) => {
  const [row] = await db
    .select()
    .from(selfHostedNodes)
    .where(
      and(
        eq(selfHostedNodes.nodeHash, nodeHash),
        eq(selfHostedNodes.userId, userId),
      ),
    )
    .limit(1);
  return row;
};

export const setNodeOwnerDisabled = async (
  nodeId: string,
  userId: string,
  isDisabled: boolean,
): Promise<SelfHostedNodeSummary | null> => {
  const [existing] = await db
    .select()
    .from(selfHostedNodes)
    .where(
      and(eq(selfHostedNodes.id, nodeId), eq(selfHostedNodes.userId, userId)),
    )
    .limit(1);
  if (!existing) {
    return null;
  }

  let isReachable = false;
  if (!isDisabled && existing.nodeHash && existing.publicHttpsUrl) {
    isReachable = await probeNodeReachability(
      existing.publicHttpsUrl,
      existing.nodeHash,
    );
  }
  const now = new Date();
  const [updated] = await db
    .update(selfHostedNodes)
    .set({
      isOwnerDisabled: isDisabled,
      forwardingEnabled: isDisabled ? false : isReachable,
      status: isDisabled
        ? "not_reachable"
        : isReachable
          ? "ok"
          : "not_reachable",
      lastReachabilityAt: isDisabled ? existing.lastReachabilityAt : now,
      updatedAt: now,
    })
    .where(eq(selfHostedNodes.id, nodeId))
    .returning();
  return mapNodeSummary(updated);
};

export const deleteSelfHostedNode = async (
  nodeId: string,
  userId: string,
): Promise<boolean> => {
  const deleted = await db
    .delete(selfHostedNodes)
    .where(
      and(eq(selfHostedNodes.id, nodeId), eq(selfHostedNodes.userId, userId)),
    )
    .returning({ id: selfHostedNodes.id });
  return Boolean(deleted[0]);
};

export const registerSelfHostedNode = async (input: {
  linkCode: string;
  publicHttpsUrl: string;
  setupChallenge: string;
}): Promise<{
  nodeHash: string;
  authSecret: string;
  cloudAccessSecret: string;
  status: SelfHostedNodeStatus;
  isForwardingEnabled: boolean;
}> => {
  const linkCode = normalizeLinkCode(input.linkCode);
  const publicHttpsUrl = normalizePublicHttpsUrl(input.publicHttpsUrl);
  if (input.setupChallenge.length < 24 || input.setupChallenge.length > 128) {
    throw new Error("Invalid setup challenge.");
  }
  await assertPublicDns(publicHttpsUrl);

  const [node] = await db
    .select()
    .from(selfHostedNodes)
    .where(eq(selfHostedNodes.linkCodeHash, hashToken(linkCode)))
    .limit(1);
  if (
    !node ||
    node.nodeHash ||
    !node.linkCodeHash ||
    !node.linkCodeExpiresAt ||
    node.linkCodeExpiresAt.getTime() <= Date.now()
  ) {
    throw new Error("The link code is invalid or has already been used.");
  }

  const authSecret = randomBytes(32).toString("base64url");
  const cloudAccessSecret = randomBytes(32).toString("base64url");
  const now = new Date();
  const isReachable = await probeNodeReachability(
    publicHttpsUrl,
    input.setupChallenge,
  );
  let nodeHash = "";
  let updated: typeof selfHostedNodes.$inferSelect | undefined;
  for (let attempt = 0; attempt < 5 && !updated; attempt += 1) {
    nodeHash = await generateUniqueNodeHash();
    try {
      [updated] = await db
        .update(selfHostedNodes)
        .set({
          linkCodeHash: null,
          linkCodeExpiresAt: null,
          nodeHash,
          publicHttpsUrl,
          status: isReachable ? "ok" : "not_reachable",
          forwardingEnabled: isReachable,
          authSecretHash: hashToken(authSecret),
          cloudAccessSecret,
          lastPingAt: now,
          lastReachabilityAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(selfHostedNodes.id, node.id),
            isNull(selfHostedNodes.nodeHash),
          ),
        )
        .returning();
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code !== "23505") {
        throw error;
      }
    }
  }
  if (!updated) {
    throw new Error(
      "The link code was consumed or a node hash could not be allocated.",
    );
  }
  return {
    nodeHash,
    authSecret,
    cloudAccessSecret,
    status: isReachable ? "ok" : "not_reachable",
    isForwardingEnabled: isReachable,
  };
};

const authenticateNode = async (nodeHash: string, authSecret: string) => {
  const [node] = await db
    .select()
    .from(selfHostedNodes)
    .where(eq(selfHostedNodes.nodeHash, nodeHash))
    .limit(1);
  if (
    !node?.authSecretHash ||
    !safeTokenMatch(authSecret, node.authSecretHash)
  ) {
    return null;
  }
  return node;
};

export const pingSelfHostedNode = async (
  nodeHash: string,
  authSecret: string,
): Promise<SelfHostedNodeSummary | null> => {
  const node = await authenticateNode(nodeHash, authSecret);
  if (!node?.publicHttpsUrl) {
    return null;
  }
  const now = new Date();
  await db
    .update(selfHostedNodes)
    .set({ lastPingAt: now, updatedAt: now })
    .where(eq(selfHostedNodes.id, node.id));
  const isReachable = await probeNodeReachability(
    node.publicHttpsUrl,
    nodeHash,
  );
  const [updated] = await db
    .update(selfHostedNodes)
    .set({
      status: isReachable ? "ok" : "not_reachable",
      forwardingEnabled:
        isReachable && !node.isOwnerDisabled ? true : node.forwardingEnabled,
      lastReachabilityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(selfHostedNodes.id, node.id))
    .returning();
  return mapNodeSummary(updated);
};

export const resolveNodeShareTarget = async (
  nodeHash: string,
): Promise<
  | { kind: "missing" }
  | { kind: "unavailable" }
  | { kind: "available"; publicHttpsUrl: string; cloudAccessSecret: string }
> => {
  const [node] = await db
    .select()
    .from(selfHostedNodes)
    .where(eq(selfHostedNodes.nodeHash, nodeHash))
    .limit(1);
  if (
    !node?.publicHttpsUrl ||
    !node.authSecretHash ||
    !node.cloudAccessSecret
  ) {
    return { kind: "missing" };
  }
  const isExpired =
    !node.lastPingAt ||
    Date.now() - node.lastPingAt.getTime() > TWENTY_FOUR_HOURS_MS;
  if (isExpired) {
    await db
      .update(selfHostedNodes)
      .set({
        status: "not_reachable",
        forwardingEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(selfHostedNodes.id, node.id));
    return { kind: "unavailable" };
  }
  if (!node.forwardingEnabled || node.isOwnerDisabled) {
    return { kind: "unavailable" };
  }
  return {
    kind: "available",
    publicHttpsUrl: node.publicHttpsUrl,
    cloudAccessSecret: node.cloudAccessSecret,
  };
};

export const createNodeLoginAuthorization = async (
  nodeHash: string,
  userId: string,
): Promise<string | null> => {
  const node = await getSelfHostedNodeForUser(nodeHash, userId);
  if (!node?.publicHttpsUrl || node.isOwnerDisabled) {
    return null;
  }
  const code = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(nodeLoginCodes).values({
    id: randomUUID(),
    nodeId: node.id,
    codeHash: hashToken(code),
    expiresAt: new Date(now.getTime() + LOGIN_CODE_TTL_MS),
    createdAt: now,
  });
  const callback = new URL("/node-auth/callback", node.publicHttpsUrl);
  callback.searchParams.set("code", code);
  callback.searchParams.set("node", nodeHash);
  return callback.toString();
};

export const exchangeNodeLoginCode = async (input: {
  nodeHash: string;
  code: string;
  authSecret: string;
}): Promise<{ id: string; email: string; username: string } | null> => {
  const node = await authenticateNode(input.nodeHash, input.authSecret);
  if (!node || node.isOwnerDisabled) {
    return null;
  }
  const [loginCode] = await db
    .select()
    .from(nodeLoginCodes)
    .where(
      and(
        eq(nodeLoginCodes.nodeId, node.id),
        eq(nodeLoginCodes.codeHash, hashToken(input.code)),
        isNull(nodeLoginCodes.consumedAt),
      ),
    )
    .limit(1);
  if (!loginCode || loginCode.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const consumed = await db
    .update(nodeLoginCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(nodeLoginCodes.id, loginCode.id),
        isNull(nodeLoginCodes.consumedAt),
      ),
    )
    .returning({ id: nodeLoginCodes.id });
  if (!consumed[0]) {
    return null;
  }
  const [user] = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(eq(users.id, node.userId))
    .limit(1);
  return user ?? null;
};

export const getOrCreateNodeInstanceSettings = async () => {
  const [existing] = await db
    .select()
    .from(nodeInstanceSettings)
    .where(eq(nodeInstanceSettings.id, NODE_INSTANCE_ID))
    .limit(1);
  if (existing) {
    return existing;
  }
  const now = new Date();
  const [created] = await db
    .insert(nodeInstanceSettings)
    .values({
      id: NODE_INSTANCE_ID,
      cloudBaseUrl: getLatexCloudBaseUrl(),
      setupChallenge: randomBytes(32).toString("base64url"),
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();
  if (created) {
    return created;
  }
  const [raced] = await db
    .select()
    .from(nodeInstanceSettings)
    .where(eq(nodeInstanceSettings.id, NODE_INSTANCE_ID))
    .limit(1);
  if (!raced) {
    throw new Error("Unable to initialize node settings.");
  }
  return raced;
};

export const saveLinkedNodeInstance = async (input: {
  publicHttpsUrl: string;
  nodeHash: string;
  authSecret: string;
  cloudAccessSecret: string;
  linkedCloudUserId?: string;
}) => {
  const [updated] = await db
    .update(nodeInstanceSettings)
    .set({
      publicHttpsUrl: normalizePublicHttpsUrl(input.publicHttpsUrl),
      nodeHash: input.nodeHash,
      authSecret: input.authSecret,
      cloudAccessSecret: input.cloudAccessSecret,
      linkedCloudUserId: input.linkedCloudUserId,
      linkedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(nodeInstanceSettings.id, NODE_INSTANCE_ID))
    .returning();
  return updated;
};

export const pingLatexCloud = async (): Promise<boolean> => {
  if (!isNodeMode()) {
    return false;
  }
  const settings = await getOrCreateNodeInstanceSettings();
  if (!settings.nodeHash || !settings.authSecret) {
    return false;
  }
  try {
    const response = await fetch(
      new URL("/api/nodes/ping", settings.cloudBaseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.authSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nodeHash: settings.nodeHash }),
        cache: "no-store",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS + 5_000),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
};

export const exchangeCloudLoginForNode = async (
  code: string,
  nodeHash: string,
) => {
  const settings = await getOrCreateNodeInstanceSettings();
  if (settings.nodeHash !== nodeHash || !settings.authSecret) {
    return null;
  }
  try {
    const response = await fetch(
      new URL("/api/nodes/auth/exchange", settings.cloudBaseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.authSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nodeHash, code }),
        cache: "no-store",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as {
      id: string;
      email: string;
      username: string;
    };
  } catch {
    return null;
  }
};

export const isCloudAccessAuthorized = async (
  authorization: string | null,
): Promise<boolean> => {
  if (!isNodeMode() || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const settings = await getOrCreateNodeInstanceSettings();
  const supplied = authorization.slice("Bearer ".length).trim();
  if (!settings.cloudAccessSecret || !supplied) {
    return false;
  }
  const actual = Buffer.from(hashToken(supplied), "hex");
  const expected = Buffer.from(hashToken(settings.cloudAccessSecret), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
