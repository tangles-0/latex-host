import { describe, expect, it } from "vitest";

import {
  isPublicIpAddress,
  normalizePublicHttpsUrl,
} from "@/lib/self-hosted-nodes";

describe("normalizePublicHttpsUrl", () => {
  it("normalizes a public HTTPS origin", () => {
    expect(normalizePublicHttpsUrl("https://files.example.com/")).toBe(
      "https://files.example.com",
    );
  });

  it("rejects HTTP and URLs with paths or credentials", () => {
    expect(() => normalizePublicHttpsUrl("http://files.example.com")).toThrow(
      "must use HTTPS",
    );
    expect(() =>
      normalizePublicHttpsUrl("https://files.example.com/private"),
    ).toThrow("without a path");
    expect(() =>
      normalizePublicHttpsUrl("https://user:pass@files.example.com"),
    ).toThrow("cannot contain credentials");
  });

  it("rejects local hostnames", () => {
    expect(() => normalizePublicHttpsUrl("https://localhost")).toThrow(
      "public DNS",
    );
    expect(() => normalizePublicHttpsUrl("https://nas.local")).toThrow(
      "public DNS",
    );
  });
});

describe("isPublicIpAddress", () => {
  it("accepts public IPv4 and IPv6 addresses", () => {
    expect(isPublicIpAddress("1.1.1.1")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects private, loopback, and link-local addresses", () => {
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("172.16.1.1")).toBe(false);
    expect(isPublicIpAddress("192.168.1.1")).toBe(false);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fd00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
  });
});
