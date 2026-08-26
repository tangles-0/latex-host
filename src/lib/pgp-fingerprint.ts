export function normalizeFingerprint(value: string): string {
  return value.replace(/[\s:]/g, "").toUpperCase();
}

export function isValidFingerprint(value: string): boolean {
  return /^[0-9A-F]{40}$/.test(normalizeFingerprint(value));
}

export function fingerprintsMatch(actual: string, expected: string): boolean {
  return isValidFingerprint(actual) && isValidFingerprint(expected)
    ? normalizeFingerprint(actual) === normalizeFingerprint(expected)
    : false;
}
