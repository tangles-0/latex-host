import { describe, expect, it } from "vitest";

import { fingerprintsMatch } from "@/lib/pgp-fingerprint";

const FINGERPRINT = "0123456789ABCDEF0123456789ABCDEF01234567";

describe("fingerprintsMatch", () => {
  it("matches fingerprints regardless of case, spaces, or colons", () => {
    expect(
      fingerprintsMatch(
        FINGERPRINT,
        "0123 4567 89ab cdef 0123 4567 89ab cdef 0123 4567",
      ),
    ).toBe(true);
    expect(
      fingerprintsMatch(
        FINGERPRINT,
        "0123:4567:89ab:cdef:0123:4567:89ab:cdef:0123:4567",
      ),
    ).toBe(true);
  });

  it("rejects mismatched or malformed fingerprints", () => {
    expect(
      fingerprintsMatch(
        FINGERPRINT,
        "1123456789ABCDEF0123456789ABCDEF01234567",
      ),
    ).toBe(false);
    expect(fingerprintsMatch(FINGERPRINT, "01234567")).toBe(false);
  });
});
