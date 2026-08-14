import { createHash, randomBytes, randomUUID } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";

export const API_KEY_PREFIX = "lh_live_";
export const MAX_ACTIVE_API_KEYS_PER_USER = 20;
export const MAX_API_KEY_DESCRIPTION_LENGTH = 200;
export const MAX_ALLOWED_DOMAINS_PER_KEY = 20;

export type ApiKeyRow = {
  id: string;
  userId: string;
  description: string;
  tokenPrefix: string;
  tokenLastFour: string;
  allowedDomains: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export type ApiKeyPublic = {
  id: string;
  description: string;
  tokenPrefix: string;
  tokenLastFour: string;
  displayHint: string;
  allowedDomains: string[];
  createdAt: string;
  lastUsedAt: string | null;
  isRevoked: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createApiKeyPlaintext(): { token: string; tokenHash: string } {
  const secret = randomBytes(32).toString("hex");
  const token = `${API_KEY_PREFIX}${secret}`;
  return { token, tokenHash: hashToken(token) };
}

export function parseAllowedDomains(input: unknown): string[] | { error: string } {
  if (input === undefined || input === null) {
    return [];
  }
  let raw: string[] = [];
  if (typeof input === "string") {
    raw = input
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  } else if (Array.isArray(input)) {
    if (!input.every((value) => typeof value === "string")) {
      return { error: "allowedDomains must be an array of strings." };
    }
    raw = input.map((value) => value.trim()).filter(Boolean);
  } else {
    return { error: "allowedDomains must be a string or string array." };
  }

  if (raw.length > MAX_ALLOWED_DOMAINS_PER_KEY) {
    return {
      error: `At most ${MAX_ALLOWED_DOMAINS_PER_KEY} domains are allowed.`,
    };
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const result = normalizeDomainPattern(entry);
    if ("error" in result) {
      return result;
    }
    if (seen.has(result.domain)) {
      continue;
    }
    seen.add(result.domain);
    normalized.push(result.domain);
  }
  return normalized;
}

export function normalizeDomainPattern(
  input: string,
): { domain: string } | { error: string } {
  let value = input.trim().toLowerCase();
  if (!value) {
    return { error: "Domain cannot be empty." };
  }
  if (value.includes("://") || value.includes("/") || value.includes("?") || value.includes("#")) {
    return {
      error: "Domains must be hosts only (no scheme or path), e.g. example.com or *.example.com.",
    };
  }
  if (value.includes(":") && !value.startsWith("*.")) {
    // Reject host:port — whitelist is hostname only.
    return { error: "Domains must not include a port." };
  }
  if (value.startsWith("*.")) {
    const rest = value.slice(2);
    if (!rest || rest.includes("*") || !isValidHostname(rest)) {
      return { error: `Invalid wildcard domain: ${input}` };
    }
    return { domain: `*.${rest}` };
  }
  if (value.includes("*") || !isValidHostname(value)) {
    return { error: `Invalid domain: ${input}` };
  }
  return { domain: value };
}

function isValidHostname(value: string): boolean {
  if (value.length > 253) {
    return false;
  }
  if (value === "localhost") {
    return true;
  }
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(
    value,
  );
}

export function hostMatchesAllowedDomains(
  host: string | null | undefined,
  allowedDomains: string[],
): boolean {
  if (!allowedDomains.length) {
    return true;
  }
  if (!host) {
    return false;
  }
  const normalizedHost = host.trim().toLowerCase().replace(/\.$/, "");
  for (const pattern of allowedDomains) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".example.com"
      const bare = pattern.slice(2); // "example.com"
      if (normalizedHost === bare || normalizedHost.endsWith(suffix)) {
        return true;
      }
      continue;
    }
    if (normalizedHost === pattern) {
      return true;
    }
  }
  return false;
}

export function requestHostForApiKey(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      // fall through
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).hostname.toLowerCase();
    } catch {
      // fall through
    }
  }
  return null;
}

function toPublic(row: typeof apiKeys.$inferSelect): ApiKeyPublic {
  return {
    id: row.id,
    description: row.description,
    tokenPrefix: row.tokenPrefix,
    tokenLastFour: row.tokenLastFour,
    displayHint: `${row.tokenPrefix}…${row.tokenLastFour}`,
    allowedDomains: Array.isArray(row.allowedDomains) ? row.allowedDomains : [],
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    isRevoked: Boolean(row.revokedAt),
  };
}

export async function listApiKeysForUser(userId: string): Promise<ApiKeyPublic[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map(toPublic);
}

export async function countActiveApiKeysForUser(userId: string): Promise<number> {
  const rows = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  return rows.length;
}

export async function createApiKeyForUser(input: {
  userId: string;
  description: string;
  allowedDomains?: string[];
}): Promise<{ key: ApiKeyPublic; token: string }> {
  const description = input.description.trim();
  if (!description) {
    throw new Error("Description is required.");
  }
  if (description.length > MAX_API_KEY_DESCRIPTION_LENGTH) {
    throw new Error(
      `Description must be at most ${MAX_API_KEY_DESCRIPTION_LENGTH} characters.`,
    );
  }

  const activeCount = await countActiveApiKeysForUser(input.userId);
  if (activeCount >= MAX_ACTIVE_API_KEYS_PER_USER) {
    throw new Error(
      `You can have at most ${MAX_ACTIVE_API_KEYS_PER_USER} active API keys.`,
    );
  }

  const allowedDomains = input.allowedDomains ?? [];
  const { token, tokenHash } = createApiKeyPlaintext();
  const id = randomUUID();
  const now = new Date();
  const tokenPrefix = token.slice(0, API_KEY_PREFIX.length + 4);
  const tokenLastFour = token.slice(-4);

  await db.insert(apiKeys).values({
    id,
    userId: input.userId,
    description,
    tokenHash,
    tokenPrefix,
    tokenLastFour,
    allowedDomains,
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
  });

  return {
    token,
    key: {
      id,
      description,
      tokenPrefix,
      tokenLastFour,
      displayHint: `${tokenPrefix}…${tokenLastFour}`,
      allowedDomains,
      createdAt: now.toISOString(),
      lastUsedAt: null,
      isRevoked: false,
    },
  };
}

export async function updateApiKeyDescriptionForUser(input: {
  userId: string;
  keyId: string;
  description: string;
}): Promise<ApiKeyPublic | null> {
  const description = input.description.trim();
  if (!description) {
    throw new Error("Description is required.");
  }
  if (description.length > MAX_API_KEY_DESCRIPTION_LENGTH) {
    throw new Error(
      `Description must be at most ${MAX_API_KEY_DESCRIPTION_LENGTH} characters.`,
    );
  }
  const [row] = await db
    .update(apiKeys)
    .set({ description })
    .where(
      and(
        eq(apiKeys.id, input.keyId),
        eq(apiKeys.userId, input.userId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning();
  return row ? toPublic(row) : null;
}

export async function revokeApiKeyForUser(
  userId: string,
  keyId: string,
): Promise<boolean> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)),
    )
    .returning({ id: apiKeys.id });
  return Boolean(row);
}

export type VerifiedApiKey = {
  userId: string;
  apiKeyId: string;
  allowedDomains: string[];
};

export async function verifyApiKeyToken(
  token: string,
): Promise<VerifiedApiKey | null> {
  const trimmed = token.trim();
  if (!trimmed.startsWith(API_KEY_PREFIX) || trimmed.length < API_KEY_PREFIX.length + 16) {
    return null;
  }
  const tokenHash = hashToken(trimmed);
  const [row] = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      allowedDomains: apiKeys.allowedDomains,
      revokedAt: apiKeys.revokedAt,
      bannedAt: users.bannedAt,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(eq(apiKeys.tokenHash, tokenHash))
    .limit(1);
  if (!row || row.revokedAt || row.bannedAt) {
    return null;
  }
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return {
    userId: row.userId,
    apiKeyId: row.id,
    allowedDomains: Array.isArray(row.allowedDomains) ? row.allowedDomains : [],
  };
}
