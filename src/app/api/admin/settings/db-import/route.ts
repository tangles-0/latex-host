import { NextResponse } from "next/server";
import postgres from "postgres";
import { get as blobGet } from "@vercel/blob";
import { getSessionUserId } from "@/lib/auth";
import { isAdminUser } from "@/lib/metadata-store";

export const runtime = "nodejs";

const IS_ENABLED = true;
const MAX_SQL_BYTES = 100 * 1024 * 1024;

type ImportPayload = { blobPath?: string };

export async function POST(request: Request): Promise<NextResponse> {
  if (!IS_ENABLED) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const connectionString = resolveConnectionString();
  if (!connectionString) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 500 });
  }

  try {
    const sqlText = await readSqlPayload(request);
    if (!sqlText.trim()) {
      return NextResponse.json({ error: "SQL payload is empty." }, { status: 400 });
    }

    const useSsl = process.env.PGSSLMODE === "require";
    const dbClient = postgres(connectionString, {
      max: 1,
      ssl: useSsl ? "require" : undefined,
    });
    try {
      await dbClient.unsafe(sqlText);
    } finally {
      await dbClient.end({ timeout: 5 });
    }
    return NextResponse.json({ message: "SQL import completed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SQL import failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function resolveConnectionString(): string | undefined {
  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const port = process.env.PGPORT ?? "5432";

  if (host && database && user && password) {
    const encodedPassword = encodeURIComponent(password);
    return `postgres://${user}:${encodedPassword}@${host}:${port}/${database}`;
  }

  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

async function readSqlPayload(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as ImportPayload;
    const blobPath = payload.blobPath?.trim();
    if (!blobPath) {
      throw new Error("Provide a Blob path.");
    }
    return readBlobAsText(blobPath);
  }

  const formData = await request.formData();
  const file = formData.get("dump");
  if (!(file instanceof File)) {
    throw new Error("Upload a .sql file.");
  }
  if (!file.name.toLowerCase().endsWith(".sql")) {
    throw new Error("Only .sql imports are supported.");
  }
  if (file.size <= 0) {
    throw new Error("SQL file is empty.");
  }
  if (file.size > MAX_SQL_BYTES) {
    throw new Error("SQL file is too large (max 100 MB).");
  }
  return file.text();
}

async function readBlobAsText(pathname: string): Promise<string> {
  const blobResult = await blobGet(pathname, { access: "private", useCache: false });
  if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
    throw new Error("Blob SQL file was not found.");
  }
  const reader = blobResult.stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      if (next.value) {
        total += next.value.length;
        if (total > MAX_SQL_BYTES) {
          throw new Error("Blob SQL file is too large (max 100 MB).");
        }
        chunks.push(next.value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}
