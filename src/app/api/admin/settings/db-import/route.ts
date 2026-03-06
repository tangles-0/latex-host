import { NextResponse } from "next/server";
import postgres from "postgres";
import { get as blobGet } from "@vercel/blob";
import { getSessionUserId } from "@/lib/auth";
import { isAdminUser } from "@/lib/metadata-store";

export const runtime = "nodejs";

const IS_ENABLED = true;
const MAX_SQL_BYTES = 100 * 1024 * 1024;

type ImportPayload = { blobPath?: string };
type SqlImportPlan = {
  statements: string[];
  originalStatementCount: number;
  resequencedInsertCount: number;
};

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
    const importPlan = buildSqlImportPlan(sqlText);
    if (importPlan.statements.length === 0) {
      return NextResponse.json({ error: "No executable SQL statements found." }, { status: 400 });
    }

    const useSsl = shouldUseSsl(connectionString);
    const dbClient = postgres(connectionString, {
      max: 1,
      ssl: useSsl ? "require" : undefined,
    });
    try {
      await dbClient.unsafe("BEGIN");
      try {
        for (const statement of importPlan.statements) {
          await dbClient.unsafe(statement);
        }
        await dbClient.unsafe("COMMIT");
      } catch (error) {
        await dbClient.unsafe("ROLLBACK");
        throw error;
      }
    } finally {
      await dbClient.end({ timeout: 5 });
    }
    return NextResponse.json({
      message: "SQL import completed.",
      importedStatements: importPlan.statements.length,
      originalStatements: importPlan.originalStatementCount,
      resequencedInserts: importPlan.resequencedInsertCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SQL import failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const FK_SAFE_TABLE_ORDER = [
  "groups",
  "group_limits",
  "app_settings",
  "users",
  "patch_notes",
  "albums",
  "images",
  "videos",
  "documents",
  "files",
  "shares",
  "video_shares",
  "document_shares",
  "file_shares",
  "album_shares",
  "upload_sessions",
];

function buildSqlImportPlan(sqlText: string): SqlImportPlan {
  const statements = splitSqlStatements(sqlText);
  const executable = statements
    .map((statement) => stripInlineSqlComments(statement).trim())
    .filter((statement) => statement.length > 0);

  const setvalStatements: string[] = [];
  const insertStatements: Array<{ sql: string; table: string; originalIndex: number }> = [];
  const otherStatements: string[] = [];

  executable.forEach((statement, index) => {
    if (/^begin\b|^start\s+transaction\b/i.test(statement) || /^commit\b/i.test(statement)) {
      return;
    }
    if (/^select\s+setval\s*\(/i.test(statement)) {
      setvalStatements.push(statement);
      return;
    }
    const tableName = parseInsertTableName(statement);
    if (tableName) {
      insertStatements.push({ sql: statement, table: tableName, originalIndex: index });
      return;
    }
    otherStatements.push(statement);
  });

  const tableOrderMap = new Map(FK_SAFE_TABLE_ORDER.map((table, idx) => [table, idx]));
  const orderedInserts = insertStatements
    .slice()
    .sort((left, right) => {
      const leftOrder = tableOrderMap.get(left.table) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = tableOrderMap.get(right.table) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.originalIndex - right.originalIndex;
    })
    .map((entry) => entry.sql);

  return {
    statements: [...otherStatements, ...orderedInserts, ...setvalStatements],
    originalStatementCount: executable.length,
    resequencedInsertCount: orderedInserts.length,
  };
}

function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;

  for (let idx = 0; idx < sqlText.length; idx += 1) {
    const char = sqlText[idx];
    const next = sqlText[idx + 1];

    if (char === "'" && inSingleQuote && next === "'") {
      current += "''";
      idx += 1;
      continue;
    }
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
    if (char === ";" && !inSingleQuote) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }
    current += char;
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }
  return statements;
}

function stripInlineSqlComments(statement: string): string {
  return statement
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"))
    .join("\n");
}

function parseInsertTableName(statement: string): string | null {
  const match = /^insert\s+into\s+(?:"?public"?\.)?(?:"([^"]+)"|([a-zA-Z0-9_]+))/i.exec(statement);
  if (!match) {
    return null;
  }
  return (match[1] ?? match[2] ?? "").toLowerCase();
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

function shouldUseSsl(connection: string | undefined): boolean {
  if (process.env.PGSSLMODE === "require") {
    return true;
  }
  if (!connection) {
    return false;
  }
  try {
    const parsed = new URL(connection);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const ssl = parsed.searchParams.get("ssl")?.toLowerCase();
    return sslMode === "require" || ssl === "true" || ssl === "1";
  } catch {
    return false;
  }
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
