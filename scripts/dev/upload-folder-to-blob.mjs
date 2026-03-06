#!/usr/bin/env node

import path from "node:path";
import { opendir, readFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import dotenv from "dotenv";

function usage() {
  console.error(
    "Usage: node scripts/dev/upload-folder-to-blob.mjs <sourceDir> [blobPrefix]\n" +
      "Example: node scripts/dev/upload-folder-to-blob.mjs /path/to/uploads uploads",
  );
}

async function* walkFiles(rootDir) {
  const dir = await opendir(rootDir);
  for await (const entry of dir) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function toPosixRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

async function main() {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env.vercel", override: true });

  const [, , sourceDirArg, blobPrefixArg = "uploads"] = process.argv;
  if (!sourceDirArg) {
    usage();
    process.exit(1);
  }
  const sourceDir = path.resolve(sourceDirArg);
  const blobPrefix = blobPrefixArg.replace(/^\/+|\/+$/g, "");
  const blobAccess = (process.env.BLOB_ACCESS?.trim().toLowerCase() === "public" ? "public" : "private");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set in environment.");
    process.exit(2);
  }

  const files = [];
  for await (const filePath of walkFiles(sourceDir)) {
    files.push(filePath);
  }

  console.log(`Found ${files.length} files in ${sourceDir}`);
  if (files.length === 0) {
    console.log("Nothing to upload.");
    return;
  }

  let uploaded = 0;
  const startedAt = Date.now();
  const concurrency = 8;
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= files.length) {
        return;
      }
      const filePath = files[currentIndex];
      const relative = toPosixRelative(sourceDir, filePath);
      const pathname = `${blobPrefix}/${relative}`;
      const data = await readFile(filePath);
      await put(pathname, data, {
        access: blobAccess,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      uploaded += 1;
      if (uploaded % 100 === 0 || uploaded === files.length) {
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
        console.log(`Uploaded ${uploaded}/${files.length} (${elapsedSec}s)`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`Done. Uploaded ${uploaded} files in ${elapsedSec}s`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
