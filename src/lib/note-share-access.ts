import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_PREFIX = "latex_note_share_unlock_";
const TOKEN_VERSION = "v1";
export const NOTE_SHARE_UNLOCK_MAX_AGE_SECONDS = 60 * 60 * 24;

function getSigningSecret(): string {
  return (
    process.env.NOTE_SHARE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "development-note-share-secret"
  );
}

function signUnlockToken(
  code: string,
  accessTokenSeed: string,
  expiresAt: number,
): string {
  return createHmac("sha256", getSigningSecret())
    .update(`${TOKEN_VERSION}:${code}:${accessTokenSeed}:${expiresAt}`)
    .digest("base64url");
}

export function getNoteShareUnlockCookieName(code: string): string {
  return `${COOKIE_PREFIX}${code}`;
}

export function createNoteShareUnlockToken(
  code: string,
  accessTokenSeed: string,
): string {
  const expiresAt =
    Math.floor(Date.now() / 1000) + NOTE_SHARE_UNLOCK_MAX_AGE_SECONDS;
  return `${TOKEN_VERSION}.${expiresAt}.${signUnlockToken(code, accessTokenSeed, expiresAt)}`;
}

export function isNoteShareUnlockTokenValid(
  code: string,
  accessTokenSeed: string,
  token: string | undefined,
): boolean {
  if (!token) {
    return false;
  }

  const [version, expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (
    version !== TOKEN_VERSION ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  const expected = signUnlockToken(code, accessTokenSeed, expiresAt);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature ?? "");
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
