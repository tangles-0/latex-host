"use client";

import * as openpgp from "openpgp";
import {
  PGP_MAX_PLAINTEXT_BYTES,
  PGP_MAX_PUBLIC_KEY_BYTES,
} from "@/lib/pgp-limits";
import { isValidFingerprint, normalizeFingerprint } from "@/lib/pgp-fingerprint";

function mapClientPgpError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  const lower = raw.toLowerCase();
  if (!raw) {
    return fallback;
  }
  if (lower.includes("private key") || lower.includes("secret key")) {
    return "Paste a public key only — private/secret keys are not accepted.";
  }
  if (lower.includes("no encryption key") || lower.includes("encryption key")) {
    return "This public key cannot encrypt messages (no usable encryption key/subkey).";
  }
  if (lower.includes("misformed") || lower.includes("ascii armor") || lower.includes("armored")) {
    return "Key does not look like a valid armored PGP public key.";
  }
  if (
    raw.startsWith("Paste ") ||
    raw.startsWith("Public key ") ||
    raw.startsWith("This public key") ||
    raw.startsWith("Could not ") ||
    raw.startsWith("Key does not") ||
    raw.startsWith("Message ")
  ) {
    return raw;
  }
  return fallback;
}

export async function validatePublicKeyArmored(armored: string): Promise<{
  fingerprint: string;
  publicKeyArmored: string;
  hasUserIds: boolean;
}> {
  const trimmed = armored.trim();
  if (!trimmed) {
    throw new Error("Public key is required.");
  }
  if (new TextEncoder().encode(trimmed).length > PGP_MAX_PUBLIC_KEY_BYTES) {
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
    throw new Error(mapClientPgpError(error, "Could not parse this as a PGP public key."));
  }

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

  const fingerprint = normalizeFingerprint(publicKey.getFingerprint());
  if (!isValidFingerprint(fingerprint)) {
    throw new Error("Could not read a valid fingerprint from this public key.");
  }

  return {
    fingerprint,
    publicKeyArmored: publicKey.armor(),
    hasUserIds: publicKey.getUserIDs().length > 0,
  };
}

export async function encryptPlaintextToPublicKey(
  plaintext: string,
  publicKeyArmored: string,
): Promise<string> {
  if (new TextEncoder().encode(plaintext).length > PGP_MAX_PLAINTEXT_BYTES) {
    throw new Error("Message exceeds the maximum allowed size before encryption.");
  }
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored.trim() });
  if (publicKey.isPrivate()) {
    throw new Error("Recipient key is invalid.");
  }
  try {
    await publicKey.getEncryptionKey();
  } catch {
    throw new Error("Recipient public key cannot encrypt messages.");
  }
  const message = await openpgp.createMessage({ text: plaintext });
  const encrypted: string = await openpgp.encrypt({
    message,
    encryptionKeys: publicKey,
    format: "armored",
  });
  return encrypted;
}
