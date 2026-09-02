import { describe, expect, it } from "vitest";

import { hasTrustedOrigin } from "@/lib/request-security";

describe("hasTrustedOrigin", () => {
  it("accepts a same-origin direct HTTP request", () => {
    const request = new Request("http://192.0.2.10:3000/api/node/setup", {
      headers: {
        host: "192.0.2.10:3000",
        origin: "http://192.0.2.10:3000",
      },
    });
    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it("uses reverse-proxy origin headers and rejects another origin", () => {
    const trusted = new Request("http://app:3000/api/node/setup", {
      headers: {
        host: "app:3000",
        origin: "https://files.example.com",
        "x-forwarded-host": "files.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(hasTrustedOrigin(trusted)).toBe(true);

    const untrusted = new Request("http://app:3000/api/node/setup", {
      headers: {
        host: "app:3000",
        origin: "https://evil.example",
        "x-forwarded-host": "files.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(hasTrustedOrigin(untrusted)).toBe(false);
  });
});
