import path from "path";
import { promises as fs } from "fs";
import postgres from "postgres";
import { put as blobPut } from "@vercel/blob";

type StorageBackend = "local" | "blob";

type TableColumn = {
  columnName: string;
};

type BackupTableSummary = {
  tableName: string;
  rowCount: number;
};

export type DbBackupResult = {
  fileName: string;
  backend: StorageBackend;
  storagePath: string;
  tableCount: number;
  totalRows: number;
  tables: BackupTableSummary[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORAGE_BACKEND =
  ((process.env.STORAGE_BACKEND as StorageBackend | undefined) ??
    (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local")) as StorageBackend;

type PgRow = Record<string, unknown>;

function resolveConnectionString(): string | undefined {
  const vercelPostgresUrl =
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim();
  if (vercelPostgresUrl) {
    return vercelPostgresUrl;
  }

  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const port = process.env.PGPORT ?? "5432";

  if (host && database && user && password) {
    const encodedPassword = encodeURIComponent(password);
    return `postgres://${user}:${encodedPassword}@${host}:${port}/${database}`;
  }

  return process.env.DATABASE_URL;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, "\"\"")}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function valueToSql(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "NULL";
    }
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    return quoteLiteral(value.toISOString());
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const hex = Buffer.from(value).toString("hex");
    return `'\\x${hex}'::bytea`;
  }
  if (Array.isArray(value)) {
    return `ARRAY[${value.map((item) => valueToSql(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `${quoteLiteral(JSON.stringify(value))}::jsonb`;
  }
  return quoteLiteral(String(value));
}

function buildBackupFileName(now: Date): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `db-backup-${iso}.sql`;
}

export async function createSqlBackupAndStore(): Promise<DbBackupResult> {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error("Database is not configured.");
  }

  const useSsl = process.env.PGSSLMODE === "require";
  const sql = postgres(connectionString, {
    max: 1,
    ssl: useSsl ? "require" : undefined,
  });

  try {
    const now = new Date();
    const fileName = buildBackupFileName(now);
    const lines: string[] = [];
    lines.push("-- latex SQL backup (data-only)");
    lines.push(`-- generated_at_utc: ${now.toISOString()}`);
    lines.push("");
    lines.push("BEGIN;");
    lines.push("");

    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `;

    const tableSummaries: BackupTableSummary[] = [];
    let totalRows = 0;

    for (const table of tables) {
      const tableName = table.table_name;
      const columns = await sql<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position ASC
      `;
      if (columns.length === 0) {
        tableSummaries.push({ tableName, rowCount: 0 });
        continue;
      }
      const quotedColumns = columns.map((column) => quoteIdentifier(column.column_name));

      const pkColumns = await sql<{ attname: string }[]>`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
        WHERE i.indisprimary = TRUE
          AND n.nspname = 'public'
          AND c.relname = ${tableName}
        ORDER BY array_position(i.indkey, a.attnum)
      `;

      const orderClause =
        pkColumns.length > 0
          ? ` ORDER BY ${pkColumns.map((column) => quoteIdentifier(column.attname)).join(", ")}`
          : "";
      const tableRows = await sql.unsafe<PgRow[]>(
        `SELECT * FROM ${quoteIdentifier("public")}.${quoteIdentifier(tableName)}${orderClause}`,
      );

      lines.push(`-- table: ${tableName} (${tableRows.length} row${tableRows.length === 1 ? "" : "s"})`);
      for (const row of tableRows) {
        const values = columns.map((column) => valueToSql(row[column.column_name]));
        lines.push(
          `INSERT INTO ${quoteIdentifier("public")}.${quoteIdentifier(tableName)} (${quotedColumns.join(", ")}) VALUES (${values.join(", ")});`,
        );
      }
      lines.push("");
      tableSummaries.push({ tableName, rowCount: tableRows.length });
      totalRows += tableRows.length;
    }

    const serialColumns = await sql<{ table_name: string; column_name: string; sequence_name: string | null }[]>`
      SELECT
        table_name,
        column_name,
        pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name ASC, ordinal_position ASC
    `;
    for (const entry of serialColumns) {
      if (!entry.sequence_name) {
        continue;
      }
      lines.push(
        `SELECT setval(${quoteLiteral(entry.sequence_name)}, COALESCE((SELECT MAX(${quoteIdentifier(entry.column_name)}) FROM ${quoteIdentifier("public")}.${quoteIdentifier(entry.table_name)}), 1), (SELECT MAX(${quoteIdentifier(entry.column_name)}) IS NOT NULL FROM ${quoteIdentifier("public")}.${quoteIdentifier(entry.table_name)}));`,
      );
    }

    lines.push("");
    lines.push("COMMIT;");
    lines.push("");

    const body = Buffer.from(lines.join("\n"), "utf8");
    let storagePath = "";
    if (STORAGE_BACKEND === "blob") {
      const pathname = `db-backups/${fileName}`;
      await blobPut(pathname, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/sql",
      });
      storagePath = pathname;
    } else {
      await fs.mkdir(DATA_DIR, { recursive: true });
      storagePath = path.join(DATA_DIR, fileName);
      await fs.writeFile(storagePath, body);
    }

    return {
      fileName,
      backend: STORAGE_BACKEND,
      storagePath,
      tableCount: tables.length,
      totalRows,
      tables: tableSummaries,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

