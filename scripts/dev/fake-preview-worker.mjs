#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/dev/fake-preview-worker.mjs <origin> <secret> <kind> <mediaId> [previewImagePath]",
      "",
      "Example:",
      "  node scripts/dev/fake-preview-worker.mjs http://localhost:3000 secret video 123 ./public/placeholder.png",
    ].join("\n"),
  );
}

function isValidKind(kind) {
  return kind === "video" || kind === "document" || kind === "other";
}

function fallbackPngDataUrl() {
  // 1x1 transparent PNG
  const tinyPngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2hQYQAAAAASUVORK5CYII=";
  return `data:image/png;base64,${tinyPngBase64}`;
}

async function buildPreviewDataUrl(previewImagePath) {
  if (!previewImagePath) {
    return fallbackPngDataUrl();
  }
  const bytes = await readFile(previewImagePath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function main() {
  const [origin, secret, kind, mediaId, previewImagePath] = process.argv.slice(2);
  if (!origin || !secret || !kind || !mediaId || !isValidKind(kind)) {
    usage();
    process.exit(1);
  }

  const previewBase64 = await buildPreviewDataUrl(previewImagePath);
  const response = await fetch(`${origin.replace(/\/$/, "")}/api/internal/preview-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      kind,
      mediaId,
      previewBase64,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Request failed (${response.status}): ${text}`);
    process.exit(2);
  }
  console.log(text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(3);
});
