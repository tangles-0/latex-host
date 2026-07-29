/** Shared PGP size limits safe for both client and server imports (no Node/openpgp). */

export const PGP_MAX_CIPHERTEXT_BYTES = 256 * 1024;
export const PGP_MAX_PUBLIC_KEY_BYTES = 64 * 1024;
export const PGP_MAX_VERIFY_CODE_LENGTH = 64;
export const PGP_MAX_PLAINTEXT_BYTES = 128 * 1024;
