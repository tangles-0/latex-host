import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readNodePreviewScratchFile } from "@/lib/node-preview-path";

describe("readNodePreviewScratchFile", () => {
  it("reads a regular file under the configured scratch root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "latex-preview-"));
    const previousRoot = process.env.NODE_PREVIEW_SCRATCH_ROOT;
    try {
      process.env.NODE_PREVIEW_SCRATCH_ROOT = root;
      await mkdir(path.join(root, "thumbnails"));
      const output = path.join(root, "thumbnails", "preview.jpg");
      await writeFile(output, "jpeg");
      expect((await readNodePreviewScratchFile(output)).toString()).toBe(
        "jpeg",
      );
    } finally {
      if (previousRoot === undefined) {
        delete process.env.NODE_PREVIEW_SCRATCH_ROOT;
      } else {
        process.env.NODE_PREVIEW_SCRATCH_ROOT = previousRoot;
      }
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects paths outside the root and symbolic links", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "latex-preview-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "latex-outside-"));
    const previousRoot = process.env.NODE_PREVIEW_SCRATCH_ROOT;
    try {
      process.env.NODE_PREVIEW_SCRATCH_ROOT = root;
      const outsideFile = path.join(outside, "preview.jpg");
      await writeFile(outsideFile, "jpeg");
      await symlink(outsideFile, path.join(root, "linked.jpg"));
      await expect(readNodePreviewScratchFile(outsideFile)).rejects.toThrow(
        "escapes",
      );
      await expect(
        readNodePreviewScratchFile(path.join(root, "linked.jpg")),
      ).rejects.toThrow("symbolic links");
    } finally {
      if (previousRoot === undefined) {
        delete process.env.NODE_PREVIEW_SCRATCH_ROOT;
      } else {
        process.env.NODE_PREVIEW_SCRATCH_ROOT = previousRoot;
      }
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ]);
    }
  });
});
