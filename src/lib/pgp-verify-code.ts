import { PGP_MAX_VERIFY_CODE_LENGTH } from "@/lib/pgp-limits";

/** Client-safe verify-code format checks (no Node crypto). */

export function normalizeVerifyCodeInput(code: string): string {
  return code.trim().toLowerCase();
}

export function isValidVerifyCodeFormat(code: string): boolean {
  const normalized = normalizeVerifyCodeInput(code);
  return (
    normalized.length > 0 &&
    normalized.length <= PGP_MAX_VERIFY_CODE_LENGTH &&
    /^[0-9a-f]+$/.test(normalized)
  );
}
