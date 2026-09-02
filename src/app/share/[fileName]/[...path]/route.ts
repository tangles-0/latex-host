import type { NextRequest } from "next/server";

import {
  isSafePublicNodeUrl,
  resolveNodeShareTarget,
} from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

type RouteParams = Promise<{ fileName: string; path: string[] }>;

type NodeAlbumMedia = {
  id: string;
  kind: string;
  baseName: string;
  originalFileName?: string;
  ext: string;
  previewStatus?: string;
  albumCaption?: string;
};

type NodeSharePayload =
  | {
      type: "album";
      shareId: string;
      album: {
        name: string;
        displayAsCompactView?: boolean;
        displayAsDownloadPage?: boolean;
      };
      media: NodeAlbumMedia[];
    }
  | {
      type: "note";
      shareCode: string;
      fileName: string;
      updatedAt?: string;
      requiresPassword: boolean;
      content?: string;
    };

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const corsHeaders = (headers = new Headers()): Headers => {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Range",
  );
  headers.set(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Content-Length, Content-Range",
  );
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  return headers;
};

const htmlResponse = (body: string, status = 200): Response =>
  new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>latex.gg self-hosted share</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:24px;color:#171717}
    a{color:#047857}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
    article{border:1px solid #ddd;border-radius:8px;padding:12px}.preview{width:100%;height:180px;object-fit:contain;background:#f5f5f5}
    pre{white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:#737373;font-size:12px}
    input,button{font:inherit;padding:8px;border:1px solid #ccc;border-radius:5px}button{cursor:pointer}
  </style>
</head>
<body>${body}</body>
</html>`,
    {
      status,
      headers: corsHeaders(
        new Headers({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        }),
      ),
    },
  );

const renderAlbum = (
  nodeHash: string,
  payload: Extract<NodeSharePayload, { type: "album" }>,
): Response => {
  const items = payload.media
    .map((item) => {
      const name = escapeHtml(item.originalFileName || item.baseName);
      const original = `/share/${encodeURIComponent(nodeHash)}/album/${encodeURIComponent(payload.shareId)}/media/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.id)}/${encodeURIComponent(item.baseName)}.${encodeURIComponent(item.ext)}`;
      const previewExt = item.kind === "image" ? item.ext : "png";
      const preview = `/share/${encodeURIComponent(nodeHash)}/album/${encodeURIComponent(payload.shareId)}/media/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.id)}/${encodeURIComponent(item.baseName)}-lg.${encodeURIComponent(previewExt)}`;
      const previewHtml =
        item.previewStatus === "complete" || item.kind === "image"
          ? `<a href="${original}"><img class="preview" src="${preview}" alt=""></a>`
          : "";
      return `<article>${previewHtml}<h2><a href="${original}">${name}</a></h2>${
        item.albumCaption ? `<p>${escapeHtml(item.albumCaption)}</p>` : ""
      }</article>`;
    })
    .join("");
  return htmlResponse(
    `<header><h1>${escapeHtml(payload.album.name)}</h1><p class="muted">Self-hosted by a third-party latex.gg node · ${payload.media.length} files</p></header><main class="grid">${items}</main>`,
  );
};

const renderNote = (
  nodeHash: string,
  payload: Extract<NodeSharePayload, { type: "note" }>,
  error?: string,
): Response => {
  const heading = `<header><h1>${escapeHtml(payload.fileName)}</h1><p class="muted">Self-hosted by a third-party latex.gg node${
    payload.updatedAt ? ` · Updated ${escapeHtml(payload.updatedAt)}` : ""
  }</p></header>`;
  if (typeof payload.content === "string") {
    const downloadUrl = `/share/${encodeURIComponent(nodeHash)}/${encodeURIComponent(payload.shareCode)}?download=true`;
    return htmlResponse(
      `${heading}<p><a href="${downloadUrl}">Download markdown</a></p><pre>${escapeHtml(payload.content)}</pre>`,
    );
  }
  return htmlResponse(
    `${heading}${error ? `<p style="color:#b91c1c">${escapeHtml(error)}</p>` : ""}<form method="post"><label>Password <input type="password" name="password" required autocomplete="current-password"></label> <button type="submit">Unlock note</button></form>`,
  );
};

const fetchNodeMetadata = async (
  target: Extract<
    Awaited<ReturnType<typeof resolveNodeShareTarget>>,
    { kind: "available" }
  >,
  code: string,
  password?: string,
): Promise<NodeSharePayload | null> => {
  try {
    if (!(await isSafePublicNodeUrl(target.publicHttpsUrl))) {
      return null;
    }
    const response = await fetch(
      new URL(
        `/api/node/public-share/${encodeURIComponent(code)}`,
        target.publicHttpsUrl,
      ),
      {
        method: password === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${target.cloudAccessSecret}`,
          ...(password === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body: password === undefined ? undefined : JSON.stringify({ password }),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as NodeSharePayload;
  } catch {
    return null;
  }
};

const unavailableResponse = (): Response =>
  new Response("This self-hosted node is unavailable.", {
    status: 503,
    headers: corsHeaders(
      new Headers({ "Retry-After": "3600", "Cache-Control": "no-store" }),
    ),
  });

const routeNodeShare = async (
  request: NextRequest,
  params: RouteParams,
): Promise<Response> => {
  const { fileName: nodeHash, path: pathSegments } = await params;
  if (!/^[A-Za-z0-9]{2,64}$/.test(nodeHash) || pathSegments.length === 0) {
    return new Response("Not found.", { status: 404 });
  }
  const target = await resolveNodeShareTarget(nodeHash);
  if (target.kind === "missing") {
    return new Response("Not found.", { status: 404 });
  }
  if (target.kind === "unavailable") {
    return unavailableResponse();
  }

  const first = pathSegments[0];
  const isPageShare =
    pathSegments.length === 1 &&
    !first.includes(".") &&
    request.nextUrl.searchParams.get("download") !== "true";
  if (isPageShare) {
    const payload = await fetchNodeMetadata(target, first);
    if (!payload) {
      return new Response("Share not found.", { status: 404 });
    }
    return payload.type === "album"
      ? renderAlbum(nodeHash, payload)
      : renderNote(nodeHash, payload);
  }

  const destinationPath =
    pathSegments.length === 1
      ? `/p/${encodeURIComponent(first)}`
      : `/share/${pathSegments.map(encodeURIComponent).join("/")}`;
  const location = new URL(destinationPath, target.publicHttpsUrl);
  location.search = request.nextUrl.search;
  return new Response(null, {
    status: 307,
    headers: corsHeaders(
      new Headers({
        Location: location.toString(),
        "Cache-Control": "no-store",
      }),
    ),
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<Response> {
  return routeNodeShare(request, params);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<Response> {
  return routeNodeShare(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<Response> {
  const { fileName: nodeHash, path: pathSegments } = await params;
  if (pathSegments.length !== 1) {
    return new Response("Not found.", { status: 404 });
  }
  const target = await resolveNodeShareTarget(nodeHash);
  if (target.kind !== "available") {
    return target.kind === "unavailable"
      ? unavailableResponse()
      : new Response("Not found.", { status: 404 });
  }
  const formData = await request.formData().catch(() => null);
  const password = formData?.get("password");
  if (typeof password !== "string" || !password.trim()) {
    return htmlResponse("<p>Password is required.</p>", 400);
  }
  const payload = await fetchNodeMetadata(
    target,
    pathSegments[0],
    password.trim(),
  );
  if (!payload || payload.type !== "note") {
    const fallback = await fetchNodeMetadata(target, pathSegments[0]);
    return fallback?.type === "note"
      ? renderNote(nodeHash, fallback, "Incorrect password.")
      : new Response("Share not found.", { status: 404 });
  }
  return renderNote(nodeHash, payload);
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
