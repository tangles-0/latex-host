import { describe, expect, it } from "vitest";
import {
  hostMatchesAllowedDomains,
  normalizeDomainPattern,
  parseAllowedDomains,
} from "@/lib/api-keys";

describe("api key domain whitelist", () => {
  it("normalizes hosts and wildcards", () => {
    expect(normalizeDomainPattern("Example.COM")).toEqual({
      domain: "example.com",
    });
    expect(normalizeDomainPattern("*.Example.com")).toEqual({
      domain: "*.example.com",
    });
    expect(normalizeDomainPattern("https://example.com")).toMatchObject({
      error: expect.stringContaining("hosts only"),
    });
  });

  it("parses comma and newline lists", () => {
    expect(parseAllowedDomains("a.com, *.b.com\nc.com")).toEqual([
      "a.com",
      "*.b.com",
      "c.com",
    ]);
  });

  it("matches hosts against allowlist", () => {
    expect(hostMatchesAllowedDomains("anything.com", [])).toBe(true);
    expect(hostMatchesAllowedDomains(null, ["example.com"])).toBe(false);
    expect(hostMatchesAllowedDomains("example.com", ["example.com"])).toBe(true);
    expect(hostMatchesAllowedDomains("www.example.com", ["*.example.com"])).toBe(
      true,
    );
    expect(hostMatchesAllowedDomains("example.com", ["*.example.com"])).toBe(true);
    expect(hostMatchesAllowedDomains("evil.com", ["example.com"])).toBe(false);
  });
});
