import { createHmac, timingSafeEqual } from "node:crypto"

export type WatchPartyHostTokenPayload = {
  hash: string
  role: "host"
  exp: number
}

const TOKEN_PREFIX = "v1"

const getPresenceHmacSecret = (): string =>
  process.env.PRESENCE_HMAC_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || ""

const toBase64Url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url")

const fromBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8")

const signEncodedPayload = (encodedPayload: string, secret: string): string =>
  createHmac("sha256", secret).update(`${TOKEN_PREFIX}.${encodedPayload}`).digest("base64url")

const equalSignature = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const mintWatchPartyHostToken = (
  hash: string,
  expiresInSeconds = 12 * 60 * 60,
): string => {
  const secret = getPresenceHmacSecret()
  if (!secret) {
    throw new Error("PRESENCE_HMAC_SECRET or NEXTAUTH_SECRET is not set.")
  }
  const payload: WatchPartyHostTokenPayload = {
    hash,
    role: "host",
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  return `${TOKEN_PREFIX}.${encodedPayload}.${signEncodedPayload(encodedPayload, secret)}`
}

export const verifyWatchPartyHostToken = (
  token: string,
  expectedHash: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): WatchPartyHostTokenPayload | null => {
  const secret = getPresenceHmacSecret()
  if (!secret) {
    return null
  }
  const parts = token.split(".")
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return null
  }
  const [, encodedPayload, signature] = parts
  if (!equalSignature(signature, signEncodedPayload(encodedPayload, secret))) {
    return null
  }
  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as WatchPartyHostTokenPayload
    if (payload.role !== "host" || payload.hash !== expectedHash || payload.exp <= nowSeconds) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
