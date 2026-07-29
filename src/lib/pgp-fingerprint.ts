export function normalizeFingerprint(value: string): string {
  return value.replace(/[\s:]/g, "").toUpperCase();
}

export function isValidFingerprint(value: string): boolean {
  return /^[0-9A-F]{40}$/.test(normalizeFingerprint(value));
}
