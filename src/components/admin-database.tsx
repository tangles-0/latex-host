"use client";

import { useState } from "react";
import type { BlobMediaKind } from "@/lib/media-types";

type ImportResponse = {
  message?: string;
  error?: string;
};

type DbBackupReport = {
  fileName: string;
  backend: "local" | "blob";
  storagePath: string;
  tableCount: number;
  totalRows: number;
  tables: Array<{ tableName: string; rowCount: number }>;
};

type StorageAuditReport = {
  expectedBlobPathCount: number;
  blobPathCount: number;
  missingRecords: Array<{
    kind: BlobMediaKind;
    id: string;
    baseName: string;
    ext: string;
    uploadedAt: string;
    missingKeys: string[];
    missingOriginal: boolean;
  }>;
  orphanedBlobPathnames: string[];
};

type ConfirmAction = "cleanupMissingRecords" | "cleanupOrphanedFiles" | null;

export default function AdminDatabase() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupReport, setBackupReport] = useState<DbBackupReport | null>(null);

  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<StorageAuditReport | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  async function runDatabaseBackup() {
    setBackupBusy(true);
    setBackupError(null);
    setBackupReport(null);
    const response = await fetch("/api/admin/settings/db-backup", {
      method: "POST",
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setBackupError(payload.error ?? "Unable to create backup.");
      setBackupBusy(false);
      return;
    }
    const payload = (await response.json()) as { backup?: DbBackupReport };
    setBackupReport(payload.backup ?? null);
    setBackupBusy(false);
  }

  async function runImport() {
    if (!file) {
      setError("Choose a .sql file.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsUploading(true);
    try {
      const response = await (async () => {
        const formData = new FormData();
        formData.append("dump", file);
        return fetch("/api/admin/settings/db-import", {
          method: "POST",
          body: formData,
        });
      })();

      const payload = (await response.json()) as ImportResponse;
      if (!response.ok) {
        setError(payload.error ?? "Import failed.");
        return;
      }
      setMessage(payload.message ?? "Import completed.");
    } catch {
      setError("Import failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function runStorageAudit() {
    setAuditBusy(true);
    setAuditError(null);
    setCleanupMessage(null);
    const response = await fetch("/api/admin/settings/storage-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "audit" }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setAuditError(payload.error ?? "Unable to run storage audit.");
      setAuditBusy(false);
      return;
    }
    const payload = (await response.json()) as StorageAuditReport;
    setAuditReport(payload);
    setAuditBusy(false);
  }

  async function runCleanup(action: Exclude<ConfirmAction, null>) {
    setCleanupBusy(true);
    setCleanupMessage(null);
    const response = await fetch("/api/admin/settings/storage-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json()) as { error?: string; deletedRecords?: number; deletedBlobs?: number };
    if (!response.ok) {
      setAuditError(payload.error ?? "Cleanup failed.");
      setCleanupBusy(false);
      return;
    }
    setCleanupMessage(
      action === "cleanupMissingRecords"
        ? `Deleted ${payload.deletedRecords ?? 0} record(s) with missing originals.`
        : `Deleted ${payload.deletedBlobs ?? 0} orphaned blob file(s).`,
    );
    setCleanupBusy(false);
    await runStorageAudit();
  }

  return (
    <>
      <section className="space-y-3 rounded border border-neutral-200 p-4">
        <h2 className="text-sm font-medium">Database Import</h2>
        <p className="text-xs text-neutral-600">
          Upload a `.sql` PostgreSQL dump file to import. This feature uses pure SQL execution and does not rely on
          system `pg_*` binaries.
        </p>
        <p className="text-xs text-red-600">
          NOTE: `IS_ENABLED = true;` must be set in `/src/app/api/admin/settings/db-import/route.ts` to enable this
          unsafe feature.
        </p>
        <label className="flex flex-col gap-2 text-xs">
          SQL file
          <input
            type="file"
            accept=".sql,text/sql,application/sql"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="rounded border px-3 py-2 text-xs"
          />
        </label>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => void runImport()}
            className="rounded bg-black px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? "Importing..." : "Import dump"}
          </button>
          {message ? <span className="text-emerald-600">{message}</span> : null}
          {error ? <span className="text-red-600">{error}</span> : null}
        </div>
      </section>

      <section className="space-y-3 rounded border border-neutral-200 p-4">
        <div className="space-y-2  p-3">
          <h3 className="text-xs font-medium">Create DB backup</h3>
          <p className="text-[11px] text-neutral-500">
            Generates a data-only `.sql` backup by reading all public tables and saves it to storage root.
          </p>
          <p className="text-xs text-red-600">NOTE: `IS_ENABLED = true;` must be set in `/src/app/api/admin/settings/db-backup/route.ts` to enable this unsafe feature.</p>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => void runDatabaseBackup()}
              disabled={backupBusy}
              className="rounded border border-neutral-200 px-3 py-2 disabled:opacity-50"
            >
              {backupBusy ? "Creating backup..." : "Create SQL backup"}
            </button>
            {backupError ? <span className="text-red-600">{backupError}</span> : null}
          </div>
          {backupReport ? (
            <div className="space-y-2 rounded border border-dashed border-neutral-300 p-2 text-[11px]">
              <div className="grid gap-1 sm:grid-cols-2">
                <div>backend: {backupReport.backend}</div>
                <div>file: {backupReport.fileName}</div>
                <div>storage path: {backupReport.storagePath}</div>
                <div>tables: {backupReport.tableCount}</div>
                <div>total rows: {backupReport.totalRows}</div>
              </div>
              <details>
                <summary className="cursor-pointer font-medium">Show table row counts</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded bg-neutral-50 p-2 whitespace-pre-wrap">
                  {backupReport.tables.map((entry) => `${entry.tableName}: ${entry.rowCount}`).join("\n") || "(none)"}
                </pre>
              </details>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded border border-neutral-200 p-4">
        <div className="space-y-2 p-3">
          <h3 className="text-xs font-medium">Storage consistency audit</h3>
          <p className="text-[11px] text-neutral-500">
            Finds DB records missing files in Blob and Blob files without DB records (orphans). Intended for
            migration repair and manual cleanup.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => void runStorageAudit()}
              disabled={auditBusy || cleanupBusy}
              className="rounded border border-neutral-200 px-3 py-2 disabled:opacity-50"
            >
              {auditBusy ? "Scanning..." : "Run audit"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("cleanupMissingRecords")}
              disabled={cleanupBusy || !auditReport || auditReport.missingRecords.length === 0}
              className="rounded border border-red-300 px-3 py-2 text-red-600 disabled:opacity-50"
            >
              Cleanup missing-record entries
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("cleanupOrphanedFiles")}
              disabled={cleanupBusy || !auditReport || auditReport.orphanedBlobPathnames.length === 0}
              className="rounded border border-red-300 px-3 py-2 text-red-600 disabled:opacity-50"
            >
              Cleanup orphaned Blob files
            </button>
            {auditError ? <span className="text-red-600">{auditError}</span> : null}
            {cleanupMessage ? <span className="text-emerald-600">{cleanupMessage}</span> : null}
          </div>
          {auditReport ? (
            <div className="space-y-2 rounded border border-dashed border-neutral-300 p-2 text-[11px]">
              <div className="grid gap-1 sm:grid-cols-2">
                <div>Expected blob paths: {auditReport.expectedBlobPathCount}</div>
                <div>Blob paths found: {auditReport.blobPathCount}</div>
                <div>Records with missing files: {auditReport.missingRecords.length}</div>
                <div>Orphaned blob files: {auditReport.orphanedBlobPathnames.length}</div>
              </div>
              <details>
                <summary className="cursor-pointer font-medium">Show missing record details</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded bg-neutral-50 p-2 whitespace-pre-wrap">
                  {auditReport.missingRecords
                    .slice(0, 500)
                    .map(
                      (entry) =>
                        `${entry.kind} ${entry.id} (${entry.baseName}.${entry.ext})\n  missingOriginal=${entry.missingOriginal}\n  missingKeys:\n    ${entry.missingKeys.join("\n    ")}`,
                    )
                    .join("\n\n") || "(none)"}
                </pre>
              </details>
              <details>
                <summary className="cursor-pointer font-medium">Show orphaned blob paths</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded bg-neutral-50 p-2 whitespace-pre-wrap">
                  {auditReport.orphanedBlobPathnames.slice(0, 2000).join("\n") || "(none)"}
                </pre>
              </details>
            </div>
          ) : null}
        </div>
      </section>
      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded border border-neutral-200 bg-white p-4 text-sm shadow-xl">
            <h3 className="text-base font-medium">Confirm destructive action</h3>
            <p className="mt-2 text-xs text-neutral-600">
              {confirmAction === "cleanupMissingRecords"
                ? "This will delete database rows whose original files are missing from Blob."
                : "This will delete Blob files that have no matching database record."}
            </p>
            <p className="mt-2 text-xs text-red-600">This cannot be undone.</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={cleanupBusy}
                className="rounded border border-neutral-300 px-3 py-2 text-xs"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cleanupBusy}
                className="rounded border border-red-400 px-3 py-2 text-xs text-red-700 disabled:opacity-50"
                onClick={async () => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  await runCleanup(action);
                }}
              >
                {cleanupBusy ? "Running..." : "Confirm cleanup"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
