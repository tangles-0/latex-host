import { describe, expect, it } from "vitest";

import { formatShareUrl, type NodeShareContext } from "@/lib/share-link-format";

const node: NodeShareContext = {
  cloudBaseUrl: "https://latex.gg",
  nodeHash: "n7",
  publicHttpsUrl: "https://files.example.com",
};

describe("formatShareUrl", () => {
  it("converts cloud file links to direct node links", () => {
    expect(
      formatShareUrl(
        "https://latex.gg/share/n7/abc-sm.jpg",
        "direct",
        node,
        "https://files.example.com",
      ),
    ).toBe("https://files.example.com/share/abc-sm.jpg");
  });

  it("converts cloud album links to direct node links", () => {
    expect(
      formatShareUrl(
        "https://latex.gg/share/n7/album123",
        "direct",
        node,
        "https://files.example.com",
      ),
    ).toBe("https://files.example.com/share/album123");
  });

  it("converts direct links back to cloud links", () => {
    expect(
      formatShareUrl(
        "https://files.example.com/share/abc.jpg",
        "cloud",
        node,
        "https://files.example.com",
      ),
    ).toBe("https://latex.gg/share/n7/abc.jpg");
  });

  it("preserves queries and fragments while converting", () => {
    expect(
      formatShareUrl(
        "https://latex.gg/share/n7/abc.jpg?download=1#preview",
        "direct",
        node,
        "https://files.example.com",
      ),
    ).toBe("https://files.example.com/share/abc.jpg?download=1#preview");
  });

  it("does not rewrite unrelated URLs", () => {
    expect(
      formatShareUrl(
        "https://example.net/share/n7/abc.jpg",
        "direct",
        node,
        "https://files.example.com",
      ),
    ).toBe("https://example.net/share/n7/abc.jpg");
  });

  it("makes relative links absolute when no node context is present", () => {
    expect(
      formatShareUrl("/share/abc.jpg", "cloud", null, "https://latex.gg"),
    ).toBe("https://latex.gg/share/abc.jpg");
  });
});
