import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  normalizeNodeRelativePath,
  resolveNodeBrowsePath,
} from "@/lib/node-imports";

describe("normalizeNodeRelativePath", () => {
  it("normalizes paths inside the mounted storage root", () => {
    expect(normalizeNodeRelativePath("photos/../photos/2026")).toBe(
      "photos/2026",
    );
    expect(normalizeNodeRelativePath("")).toBe("");
  });

  it("rejects absolute paths and traversal outside the root", () => {
    expect(() => normalizeNodeRelativePath("/etc/passwd")).toThrow(
      "Invalid storage path",
    );
    expect(() => normalizeNodeRelativePath("../../etc/passwd")).toThrow(
      "escapes",
    );
    expect(() => normalizeNodeRelativePath("file\0name")).toThrow(
      "Invalid storage path",
    );
  });

  it("resolves regular files but rejects symlink components", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "latex-node-import-"));
    const previousRoot = process.env.NODE_BROWSE_ROOT;
    try {
      process.env.NODE_BROWSE_ROOT = root;
      await mkdir(path.join(root, "safe"));
      await writeFile(path.join(root, "safe", "file.txt"), "safe");
      await symlink(os.tmpdir(), path.join(root, "outside"));

      expect(await resolveNodeBrowsePath("safe/file.txt")).toBe(
        path.join(root, "safe", "file.txt"),
      );
      await expect(resolveNodeBrowsePath("outside")).rejects.toThrow(
        "Symbolic links",
      );
      await expect(resolveNodeBrowsePath(".ssh/id_ed25519")).rejects.toThrow(
        "excluded",
      );
    } finally {
      if (previousRoot === undefined) {
        delete process.env.NODE_BROWSE_ROOT;
      } else {
        process.env.NODE_BROWSE_ROOT = previousRoot;
      }
      await rm(root, { recursive: true, force: true });
    }
  });
});
