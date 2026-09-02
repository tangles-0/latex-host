import { describe, expect, it } from "vitest";

import {
  isNodeDisabledApiPath,
  isNodeDisabledPagePath,
} from "@/lib/node-route-policy";

describe("node route policy", () => {
  it("blocks cloud, device, PGP, messaging, and admin APIs", () => {
    for (const pathname of [
      "/api/account/devices",
      "/api/account/pgp-key/verify",
      "/api/account/nodes/abc",
      "/api/nodes/connectivity",
      "/api/device/token",
      "/api/messages/threads/abc",
      "/api/pgp/keys/abc",
      "/api/admin/settings",
      "/api/image-generations/abc",
      "/api/abuse-reports",
    ]) {
      expect(isNodeDisabledApiPath(pathname)).toBe(true);
    }
  });

  it("keeps node core, API keys, v1, and YouTube APIs", () => {
    for (const pathname of [
      "/api/auth/session",
      "/api/node/setup",
      "/api/account/api-keys",
      "/api/v1/files",
      "/api/youtube/ingests",
      "/api/media",
      "/api/thumbnails/abc",
    ]) {
      expect(isNodeDisabledApiPath(pathname)).toBe(false);
    }
  });

  it("blocks pages for features omitted from node mode", () => {
    expect(isNodeDisabledPagePath("/admin/users")).toBe(true);
    expect(isNodeDisabledPagePath("/messages")).toBe(true);
    expect(isNodeDisabledPagePath("/account")).toBe(false);
    expect(isNodeDisabledPagePath("/gallery")).toBe(false);
  });
});
