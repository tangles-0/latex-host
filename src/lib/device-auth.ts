import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiDevices, deviceAuthCodes, users } from "@/db/schema";
import { getSessionUserId, userExists } from "@/lib/auth";

const DEFAULT_SCOPES = "messages:read messages:send pgp:read pgp:write";
const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_CODE_TTL_MS = 15 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 5;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ApiScope = "messages:read" | "messages:send" | "pgp:read" | "pgp:write";

export type RequestAuth = {
  userId: string;
  deviceId: string | null;
  scopes: Set<string>;
  via: "session" | "bearer";
};

function tokenSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.DEVICE_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET (or DEVICE_TOKEN_SECRET) must be set for device tokens.");
  }
  return secret;
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createOpaqueToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashOpaqueToken(token) };
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function createUserCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    const index = bytes[i] ?? 0;
    code += USER_CODE_ALPHABET[index % USER_CODE_ALPHABET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeUserCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatUserCode(normalized: string): string {
  const compact = normalizeUserCode(normalized);
  if (compact.length !== 8) {
    return compact;
  }
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function parseScopes(scopes: string): Set<string> {
  return new Set(
    scopes
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

/** Expand stored device scopes with any newly added defaults (e.g. pgp:write). */
export function mergeDefaultScopes(scopes: string): string {
  const set = parseScopes(scopes);
  for (const scope of parseScopes(DEFAULT_SCOPES)) {
    set.add(scope);
  }
  return Array.from(set).join(" ");
}

export function hasScope(auth: RequestAuth, scope: ApiScope): boolean {
  return auth.scopes.has(scope);
}

export function signAccessToken(input: {
  userId: string;
  deviceId: string;
  scopes: string;
}): { accessToken: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: input.userId,
    did: input.deviceId,
    scp: input.scopes,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "AT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", tokenSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return {
    accessToken: `${header}.${body}.${sig}`,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export function verifyAccessToken(token: string): {
  userId: string;
  deviceId: string;
  scopes: Set<string>;
} | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, body, sig] = parts;
  if (!header || !body || !sig) {
    return null;
  }
  const expected = createHmac("sha256", tokenSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as {
      sub?: string;
      did?: string;
      scp?: string;
      exp?: number;
    };
    if (!payload.sub || !payload.did || !payload.scp || !payload.exp) {
      return null;
    }
    if (payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return {
      userId: payload.sub,
      deviceId: payload.did,
      scopes: parseScopes(payload.scp),
    };
  } catch {
    return null;
  }
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function getRequestAuth(request?: Request): Promise<RequestAuth | null> {
  if (request) {
    const bearer = getBearerToken(request);
    if (bearer) {
      const verified = verifyAccessToken(bearer);
      if (!verified) {
        return null;
      }
      const [device] = await db
        .select({
          id: apiDevices.id,
          revokedAt: apiDevices.revokedAt,
          expiresAt: apiDevices.expiresAt,
          scopes: apiDevices.scopes,
        })
        .from(apiDevices)
        .innerJoin(users, eq(users.id, apiDevices.userId))
        .where(
          and(
            eq(apiDevices.id, verified.deviceId),
            eq(apiDevices.userId, verified.userId),
            isNull(users.bannedAt),
          ),
        )
        .limit(1);
      if (!device || device.revokedAt || device.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      // Prefer live device scopes in case they were narrowed later.
      const scopes = parseScopes(device.scopes);
      for (const scope of verified.scopes) {
        if (!scopes.has(scope)) {
          return null;
        }
      }
      await db
        .update(apiDevices)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiDevices.id, device.id));
      return {
        userId: verified.userId,
        deviceId: verified.deviceId,
        scopes,
        via: "bearer",
      };
    }
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }
  return {
    userId,
    deviceId: null,
    scopes: parseScopes(DEFAULT_SCOPES),
    via: "session",
  };
}

/** Session or Bearer user id; does not enforce scopes. */
export async function getRequestUserId(request?: Request): Promise<string | null> {
  const auth = await getRequestAuth(request);
  return auth?.userId ?? null;
}

export function getPublicAppOrigin(request: Request): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

export async function createDeviceAuthCode(input: {
  origin: string;
  deviceName?: string;
}): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}> {
  const { token: deviceCode, tokenHash: deviceCodeHash } = createOpaqueToken();
  let userCode = createUserCode();
  // Retry a few times on rare user_code collisions.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + DEVICE_CODE_TTL_MS);
      await db.insert(deviceAuthCodes).values({
        id: randomUUID(),
        deviceCodeHash,
        userCode: normalizeUserCode(userCode),
        deviceName: input.deviceName?.trim().slice(0, 80) || "TUI",
        status: "pending",
        expiresAt,
        intervalSeconds: POLL_INTERVAL_SECONDS,
        createdAt: now,
      });
      const verificationUri = `${input.origin.replace(/\/$/, "")}/account`;
      const displayCode = formatUserCode(userCode);
      return {
        deviceCode,
        userCode: displayCode,
        verificationUri,
        verificationUriComplete: `${verificationUri}?device_code=${encodeURIComponent(displayCode)}`,
        expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000),
        interval: POLL_INTERVAL_SECONDS,
      };
    } catch {
      userCode = createUserCode();
    }
  }
  throw new Error("Failed to allocate device login code.");
}

export async function approveDeviceUserCode(input: {
  userId: string;
  userCode: string;
}): Promise<{ deviceId: string; deviceName: string }> {
  const normalized = normalizeUserCode(input.userCode);
  if (normalized.length !== 8) {
    throw new Error("Invalid device code format.");
  }

  const [row] = await db
    .select()
    .from(deviceAuthCodes)
    .where(eq(deviceAuthCodes.userCode, normalized))
    .limit(1);

  if (!row || row.status !== "pending") {
    throw new Error("Device code not found or already used.");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await db
      .update(deviceAuthCodes)
      .set({ status: "expired" })
      .where(eq(deviceAuthCodes.id, row.id));
    throw new Error("Device code expired. Start a new login from the TUI.");
  }
  if (!(await userExists(input.userId))) {
    throw new Error("Account is not allowed to approve devices.");
  }

  // Placeholder refresh hash until the TUI's first successful poll rotates and returns plaintext.
  const { tokenHash: refreshTokenHash } = createOpaqueToken();
  const now = new Date();
  const deviceId = randomUUID();
  await db.insert(apiDevices).values({
    id: deviceId,
    userId: input.userId,
    name: row.deviceName || "TUI",
    refreshTokenHash,
    scopes: DEFAULT_SCOPES,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    revokedAt: null,
  });

  await db
    .update(deviceAuthCodes)
    .set({
      status: "approved",
      userId: input.userId,
      apiDeviceId: deviceId,
      approvedAt: now,
    })
    .where(eq(deviceAuthCodes.id, row.id));

  return { deviceId, deviceName: row.deviceName || "TUI" };
}

export async function pollDeviceAuthCode(deviceCode: string): Promise<
  | { status: "pending"; interval: number }
  | { status: "slow_down"; interval: number }
  | { status: "expired" }
  | {
      status: "approved";
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      scope: string;
      tokenType: "Bearer";
    }
> {
  const deviceCodeHash = hashOpaqueToken(deviceCode);
  const [row] = await db
    .select()
    .from(deviceAuthCodes)
    .where(eq(deviceAuthCodes.deviceCodeHash, deviceCodeHash))
    .limit(1);

  if (!row) {
    throw new Error("Invalid device code.");
  }

  const now = new Date();
  if (row.expiresAt.getTime() <= now.getTime() && row.status === "pending") {
    await db
      .update(deviceAuthCodes)
      .set({ status: "expired" })
      .where(eq(deviceAuthCodes.id, row.id));
    return { status: "expired" };
  }

  if (row.status === "expired" || row.status === "consumed") {
    return { status: "expired" };
  }

  if (row.lastPollAt) {
    const elapsedMs = now.getTime() - row.lastPollAt.getTime();
    if (elapsedMs < row.intervalSeconds * 1000) {
      return { status: "slow_down", interval: row.intervalSeconds };
    }
  }
  await db
    .update(deviceAuthCodes)
    .set({ lastPollAt: now })
    .where(eq(deviceAuthCodes.id, row.id));

  if (row.status === "pending") {
    return { status: "pending", interval: row.intervalSeconds };
  }

  if (row.status !== "approved" || !row.apiDeviceId || !row.userId) {
    return { status: "expired" };
  }
  if (!(await userExists(row.userId))) {
    return { status: "expired" };
  }

  const [device] = await db
    .select()
    .from(apiDevices)
    .where(eq(apiDevices.id, row.apiDeviceId))
    .limit(1);
  if (!device || device.revokedAt) {
    return { status: "expired" };
  }

  const { token: refreshToken, tokenHash: refreshTokenHash } = createOpaqueToken();
  await db
    .update(apiDevices)
    .set({
      refreshTokenHash,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    })
    .where(eq(apiDevices.id, device.id));

  await db
    .update(deviceAuthCodes)
    .set({ status: "consumed" })
    .where(eq(deviceAuthCodes.id, row.id));

  const access = signAccessToken({
    userId: row.userId,
    deviceId: device.id,
    scopes: device.scopes,
  });

  return {
    status: "approved",
    accessToken: access.accessToken,
    refreshToken,
    expiresIn: access.expiresIn,
    scope: device.scopes,
    tokenType: "Bearer",
  };
}

export async function refreshDeviceTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: "Bearer";
}> {
  const refreshTokenHash = hashOpaqueToken(refreshToken);
  const [device] = await db
    .select()
    .from(apiDevices)
    .where(eq(apiDevices.refreshTokenHash, refreshTokenHash))
    .limit(1);

  if (!device || device.revokedAt || device.expiresAt.getTime() <= Date.now()) {
    throw new Error("Invalid or expired refresh token.");
  }
  if (!(await userExists(device.userId))) {
    throw new Error("Invalid or expired refresh token.");
  }

  const { token: nextRefresh, tokenHash: nextHash } = createOpaqueToken();
  const now = new Date();
  const scopes = mergeDefaultScopes(device.scopes);
  await db
    .update(apiDevices)
    .set({
      refreshTokenHash: nextHash,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      scopes,
    })
    .where(eq(apiDevices.id, device.id));

  const access = signAccessToken({
    userId: device.userId,
    deviceId: device.id,
    scopes,
  });

  return {
    accessToken: access.accessToken,
    refreshToken: nextRefresh,
    expiresIn: access.expiresIn,
    scope: scopes,
    tokenType: "Bearer",
  };
}

export async function listApiDevices(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    scopes: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    expiresAt: Date;
    isRevoked: boolean;
  }>
> {
  const rows = await db
    .select()
    .from(apiDevices)
    .where(eq(apiDevices.userId, userId));
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      scopes: row.scopes,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
      isRevoked: Boolean(row.revokedAt) || row.expiresAt.getTime() <= Date.now(),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function revokeAllApiDevicesForUser(userId: string): Promise<void> {
  await db
    .update(apiDevices)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiDevices.userId, userId), isNull(apiDevices.revokedAt)));
}

export async function revokeApiDevice(userId: string, deviceId: string): Promise<void> {
  const [device] = await db
    .select({ id: apiDevices.id })
    .from(apiDevices)
    .where(and(eq(apiDevices.id, deviceId), eq(apiDevices.userId, userId), isNull(apiDevices.revokedAt)))
    .limit(1);
  if (!device) {
    throw new Error("Device not found.");
  }
  await db
    .update(apiDevices)
    .set({ revokedAt: new Date() })
    .where(eq(apiDevices.id, deviceId));
}
