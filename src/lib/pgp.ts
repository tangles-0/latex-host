import { createHash, randomBytes, timingSafeEqual } from "crypto";
import * as openpgp from "openpgp";
import { isValidFingerprint, normalizeFingerprint } from "@/lib/pgp-fingerprint";
import {
  PGP_MAX_CIPHERTEXT_BYTES,
  PGP_MAX_PUBLIC_KEY_BYTES,
} from "@/lib/pgp-limits";
import {
  isValidVerifyCodeFormat,
  normalizeVerifyCodeInput,
} from "@/lib/pgp-verify-code";

const VERIFY_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export {
  PGP_MAX_CIPHERTEXT_BYTES,
  PGP_MAX_PUBLIC_KEY_BYTES,
  PGP_MAX_VERIFY_CODE_LENGTH,
  PGP_MAX_PLAINTEXT_BYTES,
} from "@/lib/pgp-limits";

export { isValidFingerprint, normalizeFingerprint };
export { isValidVerifyCodeFormat, normalizeVerifyCodeInput };

export function hashVerifyCode(code: string): string {
  return createHash("sha256").update(normalizeVerifyCodeInput(code)).digest("hex");
}

export function createVerifyCode(): { code: string; codeHash: string } {
  const code = randomBytes(16).toString("hex");
  return { code, codeHash: hashVerifyCode(code) };
}

export function getVerifyExpiryDate(): Date {
  return new Date(Date.now() + VERIFY_CODE_TTL_MS);
}

export function verifyCodesMatch(submitted: string, expectedHash: string): boolean {
  if (!isValidVerifyCodeFormat(submitted)) {
    return false;
  }
  const submittedHash = hashVerifyCode(submitted);
  const a = Buffer.from(submittedHash, "utf8");
  const b = Buffer.from(expectedHash, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createSenderDisplayHash(): string {
  return randomBytes(16).toString("hex");
}

export function mapPgpError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  const lower = raw.toLowerCase();
  if (!raw) {
    return fallback;
  }
  if (lower.includes("private key") || lower.includes("secret key")) {
    return "Paste a public key only — private/secret keys are not accepted.";
  }
  if (lower.includes("encrypted") && lower.includes("not")) {
    return "Could not encrypt with this key. It may lack a usable encryption subkey.";
  }
  if (lower.includes("misformed") || lower.includes("ascii armor") || lower.includes("armored")) {
    return "Key does not look like a valid armored PGP public key.";
  }
  if (lower.includes("no encryption key") || lower.includes("encryption key")) {
    return "This public key cannot encrypt messages (no usable encryption key/subkey).";
  }
  if (lower.includes("fingerprint")) {
    return "Could not read a valid fingerprint from this public key.";
  }
  if (raw.length > 180) {
    return fallback;
  }
  // Prefer known safe messages we throw ourselves; otherwise use fallback.
  if (
    raw.startsWith("Paste ") ||
    raw.startsWith("Public key ") ||
    raw.startsWith("This public key") ||
    raw.startsWith("Could not ") ||
    raw.startsWith("Key does not") ||
    raw.startsWith("Invalid ") ||
    raw.startsWith("Message ") ||
    raw.startsWith("Encrypted message")
  ) {
    return raw;
  }
  return fallback;
}

async function assertKeyCanEncrypt(publicKey: openpgp.Key): Promise<void> {
  if (publicKey.isPrivate()) {
    throw new Error("Paste a public key only — private/secret keys are not accepted.");
  }

  try {
    await publicKey.getEncryptionKey();
  } catch {
    throw new Error(
      "This public key cannot encrypt messages (no usable encryption key/subkey).",
    );
  }

  // Prove end-to-end encryptability with a tiny probe ciphertext.
  try {
    const probe = await openpgp.createMessage({ text: "latex-host-pgp-probe" });
    await openpgp.encrypt({
      message: probe,
      encryptionKeys: publicKey,
      format: "armored",
    });
  } catch {
    throw new Error(
      "Could not encrypt with this key. It may lack a usable encryption subkey.",
    );
  }
}

export async function parsePublicKey(armored: string): Promise<{
  fingerprint: string;
  publicKeyArmored: string;
  hasUserIds: boolean;
}> {
  const trimmed = armored.trim();
  if (!trimmed) {
    throw new Error("Public key is required.");
  }
  if (Buffer.byteLength(trimmed, "utf8") > PGP_MAX_PUBLIC_KEY_BYTES) {
    throw new Error("Public key exceeds the maximum allowed size (64 KB).");
  }
  if (
    !trimmed.includes("-----BEGIN PGP PUBLIC KEY BLOCK-----") &&
    !trimmed.includes("-----BEGIN PGP PUBLIC KEY-----")
  ) {
    throw new Error(
      "Key does not look like a valid armored PGP public key. Expected a BEGIN PGP PUBLIC KEY block.",
    );
  }
  if (
    trimmed.includes("-----BEGIN PGP PRIVATE KEY BLOCK-----") ||
    trimmed.includes("-----BEGIN PGP PRIVATE KEY-----") ||
    trimmed.includes("-----BEGIN PGP SECRET KEY BLOCK-----")
  ) {
    throw new Error("Paste a public key only — private/secret keys are not accepted.");
  }

  let publicKey: openpgp.Key;
  try {
    publicKey = await openpgp.readKey({ armoredKey: trimmed });
  } catch (error) {
    throw new Error(mapPgpError(error, "Could not parse this as a PGP public key."));
  }

  await assertKeyCanEncrypt(publicKey);

  const fingerprint = normalizeFingerprint(publicKey.getFingerprint());
  if (!isValidFingerprint(fingerprint)) {
    throw new Error("Could not read a valid fingerprint from this public key.");
  }

  return {
    fingerprint,
    // Re-armor from parsed key so stored material is normalized OpenPGP output, not raw user paste.
    publicKeyArmored: publicKey.armor(),
    hasUserIds: publicKey.getUserIDs().length > 0,
  };
}

export async function encryptTextToPublicKey(
  plaintext: string,
  publicKeyArmored: string,
): Promise<string> {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
  await assertKeyCanEncrypt(publicKey);
  const message = await openpgp.createMessage({ text: plaintext });
  const encrypted: string = await openpgp.encrypt({
    message,
    encryptionKeys: publicKey,
    format: "armored",
  });
  return encrypted;
}

export async function assertEncryptedOpenPgpMessage(ciphertext: string): Promise<void> {
  const trimmed = ciphertext.trim();
  if (!trimmed.includes("-----BEGIN PGP MESSAGE-----")) {
    throw new Error("Message must be an armored OpenPGP encrypted message.");
  }
  if (Buffer.byteLength(trimmed, "utf8") > PGP_MAX_CIPHERTEXT_BYTES) {
    throw new Error("Encrypted message exceeds size limit.");
  }
  if (
    trimmed.includes("-----BEGIN PGP PUBLIC KEY") ||
    trimmed.includes("-----BEGIN PGP PRIVATE KEY") ||
    trimmed.includes("-----BEGIN PGP SIGNATURE-----")
  ) {
    throw new Error("Message must be an armored OpenPGP encrypted message.");
  }

  let message: openpgp.Message<string>;
  try {
    message = await openpgp.readMessage({ armoredMessage: trimmed });
  } catch {
    throw new Error("Message must be an armored OpenPGP encrypted message.");
  }
  if (message.getEncryptionKeyIDs().length === 0) {
    throw new Error("Message is not encrypted.");
  }
}
