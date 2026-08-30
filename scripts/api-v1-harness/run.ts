#!/usr/bin/env node
/**
 * Public API v1 validation harness.
 *
 * Env (shell overrides .env.local / .env):
 *   API_V1_BASE_URL  default http://127.0.0.1:3000
 *   API_V1_KEY       required (lh_live_…)
 *   API_V1_KEEP_UPLOADS  set to "true" to skip DELETE cleanup
 */
import { createHash, randomBytes } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";
import { uploadPart as uploadBlobPart } from "@vercel/blob/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const FIXTURES = path.join(__dirname, "fixtures");

// Prefer shell > .env.local > .env (dotenv never overrides existing keys).
loadEnv({ path: path.join(REPO_ROOT, ".env.local") });
loadEnv({ path: path.join(REPO_ROOT, ".env") });

const baseUrl = (process.env.API_V1_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const apiKey = process.env.API_V1_KEY?.trim() ?? "";
const keepUploads = process.env.API_V1_KEEP_UPLOADS === "true";

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];
const createdFileIds: string[] = [];
const createdNoteIds: string[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function authHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...(extra ?? {}),
  };
}

async function api(
  method: string,
  pathname: string,
  init?: {
    headers?: Record<string, string>;
    body?: BodyInit | null;
    raw?: boolean;
  },
): Promise<{ status: number; json: any; headers: Headers; response: Response }> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: init?.raw ? init.headers : authHeaders(init?.headers),
    body: init?.body,
  });
  let json: any = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    json = await response.json().catch(() => null);
  }
  return { status: response.status, json, headers: response.headers, response };
}

async function pollPreview(
  fileId: string,
  timeoutMs: number,
): Promise<{ previewStatus: string; previewError?: string | null }> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { status, json } = await api("GET", `/api/v1/files/${fileId}`);
    if (status !== 200) {
      throw new Error(`preview poll failed: HTTP ${status}`);
    }
    const previewStatus = String(json?.file?.previewStatus ?? "");
    if (previewStatus === "complete" || previewStatus.startsWith("error")) {
      return {
        previewStatus,
        previewError: json?.file?.previewError ?? null,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("preview poll timed out");
}

async function multipartUpload(file: File, visibility: "private" | "public") {
  const init = await api("POST", "/api/v1/uploads", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      checksum: createHash("sha256")
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("hex"),
    }),
  });
  if (init.status !== 201) {
    throw new Error(
      `init failed: ${init.status} ${JSON.stringify(init.json)}`,
    );
  }
  const upload = init.json.upload;
  const chunkSize = Number(upload.chunkSize);
  const totalParts = Number(upload.totalParts);
  const multipart = upload.multipart;

  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    const start = (partNumber - 1) * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    if (multipart) {
      const uploaded = await uploadBlobPart(upload.storageKey, chunk, {
        access: "private",
        token: multipart.token,
        key: multipart.key,
        uploadId: multipart.uploadId,
        partNumber,
        contentType: file.type || undefined,
      });
      const ack = await api(
        "PUT",
        `/api/v1/uploads/${upload.id}/parts/${partNumber}`,
        {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etag: uploaded.etag }),
        },
      );
      if (ack.status !== 200) {
        throw new Error(`part ack failed: ${ack.status}`);
      }
    } else {
      const part = await api(
        "PUT",
        `/api/v1/uploads/${upload.id}/parts/${partNumber}`,
        {
          headers: { "Content-Type": "application/octet-stream" },
          body: chunk,
        },
      );
      if (part.status !== 200) {
        throw new Error(`part upload failed: ${part.status}`);
      }
    }
  }

  const complete = await api("POST", `/api/v1/uploads/${upload.id}/complete`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility }),
  });
  if (complete.status !== 201) {
    throw new Error(
      `complete failed: ${complete.status} ${JSON.stringify(complete.json)}`,
    );
  }
  return { file: complete.json.file, transport: upload.transport as string };
}

async function cleanup() {
  if (keepUploads) {
    console.log("Keeping uploads (API_V1_KEEP_UPLOADS=true).");
    return;
  }
  for (const id of createdFileIds) {
    await api("DELETE", `/api/v1/files/${id}`);
  }
  for (const id of createdNoteIds) {
    await api("DELETE", `/api/v1/notes/${id}`);
  }
}

async function main() {
  if (!apiKey) {
    console.error("API_V1_KEY is required.");
    process.exit(2);
  }
  console.log(`Harness target: ${baseUrl}`);

  // 401 without key
  {
    const response = await fetch(`${baseUrl}/api/v1`, { method: "GET" });
    record(
      "unauthorized without key",
      response.status === 401,
      `status=${response.status}`,
    );
  }

  // discovery
  let threshold = 4 * 1024 * 1024;
  {
    const { status, json } = await api("GET", "/api/v1");
    const ok =
      status === 200 &&
      typeof json?.limits?.resumableThresholdBytes === "number" &&
      typeof json?.docs === "string";
    if (ok) {
      threshold = json.limits.resumableThresholdBytes;
    }
    record("discovery limits", ok, `threshold=${threshold}`);
  }

  // openapi + docs unauthenticated
  {
    const openapi = await fetch(`${baseUrl}/api/v1/openapi.json`);
    const docs = await fetch(`${baseUrl}/api/v1/docs`);
    record(
      "openapi + docs public",
      openapi.status === 200 && docs.status === 200,
      `openapi=${openapi.status} docs=${docs.status}`,
    );
  }

  // albums list
  {
    const { status, json } = await api("GET", "/api/v1/albums");
    record(
      "list albums",
      status === 200 && Array.isArray(json?.albums),
      `status=${status}`,
    );
  }

  // simple private upload
  {
    const png = readFileSync(path.join(FIXTURES, "screenshot.png"));
    const form = new FormData();
    form.append(
      "file",
      new File([png], "harness-private.png", { type: "image/png" }),
    );
    form.append("visibility", "private");
    form.append("keepOriginalFileName", "1");
    const { status, json } = await api("POST", "/api/v1/files", { body: form });
    const ok =
      status === 201 &&
      json?.file?.id &&
      (json.file.shareUrl === null || json.file.shareUrl === undefined);
    if (json?.file?.id) {
      createdFileIds.push(json.file.id);
    }
    record("simple private upload", ok, `status=${status}`);

    if (ok) {
      try {
        const preview = await pollPreview(json.file.id, 120_000);
        record(
          "preview poll (private png)",
          preview.previewStatus === "complete" ||
            preview.previewStatus.startsWith("error"),
          preview.previewStatus,
        );
        if (preview.previewStatus === "complete") {
          const content = await api(
            "GET",
            `/api/v1/files/${json.file.id}/content?variant=sm`,
          );
          record(
            "download sm preview",
            content.status === 200,
            `status=${content.status}`,
          );
        }
      } catch (error) {
        record(
          "preview poll (private png)",
          false,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  // simple public upload + share URL
  {
    const jpg = readFileSync(path.join(FIXTURES, "noodle.jpg"));
    const form = new FormData();
    form.append(
      "file",
      new File([jpg], "harness-public.jpg", { type: "image/jpeg" }),
    );
    form.append("visibility", "public");
    const { status, json } = await api("POST", "/api/v1/files", { body: form });
    const shareUrl = json?.file?.shareUrl as string | undefined;
    const shareUrl512 = json?.file?.shareUrls?.x512 as string | undefined;
    const ok = status === 201 && Boolean(shareUrl) && Boolean(shareUrl512);
    if (json?.file?.id) {
      createdFileIds.push(json.file.id);
    }
    record("simple public upload", ok, `status=${status}`);
    if (shareUrl) {
      const shared = await fetch(shareUrl);
      record(
        "public share URL fetch",
        shared.status === 200,
        `status=${shared.status} cors=${shared.headers.get("access-control-allow-origin")}`,
      );
    }
    if (shareUrl512) {
      const shared512 = await fetch(shareUrl512);
      record(
        "public constrained share URL fetch",
        shared512.status === 200,
        `status=${shared512.status}`,
      );
    }
  }

  // simple over threshold -> use_multipart
  {
    // Must use an allowlisted type; .bin/octet-stream is rejected as 415 first.
    const oversized = new File(
      [randomBytes(threshold)],
      "too-big.txt",
      { type: "text/plain" },
    );
    const form = new FormData();
    form.append("file", oversized);
    const { status, json } = await api("POST", "/api/v1/files", { body: form });
    record(
      "simple over threshold rejects",
      status === 413 && json?.error?.code === "use_multipart",
      `status=${status} code=${json?.error?.code}`,
    );
  }

  // multipart under min -> use_simple_upload
  {
    const { status, json } = await api("POST", "/api/v1/uploads", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "tiny.bin",
        fileSize: Math.max(1, threshold - 1),
        mimeType: "application/octet-stream",
      }),
    });
    record(
      "multipart under min rejects",
      status === 400 && json?.error?.code === "use_simple_upload",
      `status=${status} code=${json?.error?.code}`,
    );
  }

  // multipart happy path
  {
    try {
      const textFile = new File(
        [randomBytes(threshold)],
        "harness-multipart.txt",
        { type: "text/plain" },
      );
      const result = await multipartUpload(textFile, "private");
      if (result.file?.id) {
        createdFileIds.push(result.file.id);
      }
      record(
        "multipart upload",
        Boolean(result.file?.id),
        `transport=${result.transport}`,
      );
    } catch (error) {
      record(
        "multipart upload",
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // disallowed type
  {
    const exe = readFileSync(path.join(FIXTURES, "disallowed.exe"));
    const form = new FormData();
    form.append(
      "file",
      new File([exe], "malware.exe", { type: "application/octet-stream" }),
    );
    const { status, json } = await api("POST", "/api/v1/files", { body: form });
    record(
      "disallowed type rejected",
      status === 415 && json?.error?.code === "unsupported_media_type",
      `status=${status} code=${json?.error?.code}`,
    );
  }

  // notes CRUD + public share
  {
    const create = await api("POST", "/api/v1/notes", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "# harness note\n\nhello",
        originalFileName: "Harness note",
        visibility: "public",
      }),
    });
    const noteId = create.json?.note?.id as string | undefined;
    const shareUrl = create.json?.note?.shareUrl as string | undefined;
    if (noteId) {
      createdNoteIds.push(noteId);
    }
    record(
      "create public note",
      create.status === 201 && Boolean(noteId) && Boolean(shareUrl),
      `status=${create.status}`,
    );

    if (noteId) {
      const get = await api("GET", `/api/v1/notes/${noteId}`);
      record("get note", get.status === 200 && get.json?.note?.content?.includes("hello"));

      const patch = await api("PATCH", `/api/v1/notes/${noteId}`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated harness note" }),
      });
      record(
        "patch note",
        patch.status === 200 &&
          patch.json?.note?.content === "updated harness note",
      );

      await api("DELETE", `/api/v1/notes/${noteId}/share`);
      const reshare = await api("POST", `/api/v1/notes/${noteId}/share`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      record("note share revoke+create", reshare.status === 200 && Boolean(reshare.json?.shareUrl));
    }
  }

  // list pagination
  {
    const { status, json } = await api("GET", "/api/v1/files?limit=2");
    record(
      "list files",
      status === 200 && Array.isArray(json?.files),
      `count=${json?.files?.length ?? 0} next=${json?.nextCursor ?? "null"}`,
    );
  }

  // file share create/revoke
  if (createdFileIds[0]) {
    const id = createdFileIds[0];
    const share = await api("POST", `/api/v1/files/${id}/share`);
    record(
      "file share create",
      share.status === 200 &&
        Boolean(share.json?.shareUrl) &&
        Boolean(share.json?.shareUrls?.x512),
    );
    const revoke = await api("DELETE", `/api/v1/files/${id}/share`);
    record("file share revoke", revoke.status === 204);
    const afterRevoke = await api("GET", `/api/v1/files/${id}`);
    record(
      "file share revoke clears URLs",
      afterRevoke.status === 200 &&
        (afterRevoke.json?.file?.shareUrl === null ||
          afterRevoke.json?.file?.shareUrl === undefined) &&
        (afterRevoke.json?.file?.shareUrls === null ||
          afterRevoke.json?.file?.shareUrls === undefined),
    );
  }

  await cleanup();

  const failed = results.filter((result) => !result.ok);
  console.log("\nSummary:", `${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
