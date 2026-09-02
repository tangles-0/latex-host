"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { NodeBrowseEntry } from "@/lib/node-imports";

type AlbumOption = { id: string; name: string };
type ImportJob = {
  id: string;
  status: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  error: string | null;
  createdAt: string | Date;
};

type NodeImportClientProps = {
  albums: AlbumOption[];
};

const NodeImportClient = ({ albums }: NodeImportClientProps) => {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<NodeBrowseEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [albumId, setAlbumId] = useState("");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isShareAll, setIsShareAll] = useState(false);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueueing, setIsQueueing] = useState(false);

  const loadDirectory = async (nextPath: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/node/browse?path=${encodeURIComponent(nextPath)}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        path?: string;
        entries?: NodeBrowseEntry[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to browse mounted storage.");
      }
      setCurrentPath(payload.path ?? "");
      setEntries(payload.entries ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to browse mounted storage.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadJobs = async () => {
    const response = await fetch("/api/node/imports", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { jobs?: ImportJob[] };
    setJobs(payload.jobs ?? []);
  };

  useEffect(() => {
    void loadDirectory("");
    void loadJobs();
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const parentPath = useMemo(() => {
    const segments = currentPath.split("/").filter(Boolean);
    segments.pop();
    return segments.join("/");
  }, [currentPath]);

  const togglePath = (entryPath: string) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(entryPath)) {
        next.delete(entryPath);
      } else {
        next.add(entryPath);
      }
      return next;
    });
  };

  const queueImport = async () => {
    if (selectedPaths.size === 0) {
      setError("Select at least one file or folder.");
      return;
    }
    if (
      isShareAll &&
      !window.confirm(
        "Create public links for every imported file? Executables, archives, HTML, and other risky formats will be downloadable by anyone with their link.",
      )
    ) {
      return;
    }
    setError(null);
    setIsQueueing(true);
    try {
      let targetAlbumId = albumId;
      if (albumId === "__new__") {
        if (!newAlbumName.trim()) {
          throw new Error("Enter a name for the new album.");
        }
        const albumResponse = await fetch("/api/albums", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newAlbumName.trim() }),
        });
        const albumPayload = (await albumResponse.json()) as {
          album?: AlbumOption;
          error?: string;
        };
        if (!albumResponse.ok || !albumPayload.album) {
          throw new Error(albumPayload.error ?? "Unable to create album.");
        }
        targetAlbumId = albumPayload.album.id;
      }
      const response = await fetch("/api/node/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPaths: Array.from(selectedPaths),
          albumId: targetAlbumId || undefined,
          isShareAll,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to queue import.");
      }
      setSelectedPaths(new Set());
      setNewAlbumName("");
      await loadJobs();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to queue import.",
      );
    } finally {
      setIsQueueing(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    await fetch(`/api/node/imports/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });
    await loadJobs();
  };

  const retryJob = async (jobId: string) => {
    await fetch(`/api/node/imports/${encodeURIComponent(jobId)}`, {
      method: "PATCH",
    });
    await loadJobs();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-8 text-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Import mounted files</h1>
          <p className="mt-1 text-xs text-neutral-500">
            Imports use hardlinks where possible and copy otherwise. Originals
            in the browse tree are never deleted.
          </p>
        </div>
        <Link href="/gallery" className="text-emerald-700 underline">
          Back to gallery
        </Link>
      </header>
      <section className="space-y-3 rounded border border-neutral-200 p-4">
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Only mount directories intended for this gallery. Sensitive names are
          hidden by default, but the node process can read the mounted tree.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!currentPath || isLoading}
            onClick={() => loadDirectory(parentPath)}
            className="rounded border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Up
          </button>
          <code className="break-all text-xs">/{currentPath}</code>
        </div>
        {isLoading ? (
          <p className="text-neutral-500">Loading directory…</p>
        ) : null}
        {!isLoading && entries.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-300 p-4 text-neutral-500">
            This directory is empty.
          </p>
        ) : null}
        <div className="divide-y divide-neutral-200 rounded border border-neutral-200">
          {entries.map((entry) => (
            <div key={entry.path} className="flex items-center gap-3 p-2">
              <input
                type="checkbox"
                aria-label={`Select ${entry.name}`}
                checked={selectedPaths.has(entry.path)}
                onChange={() => togglePath(entry.path)}
              />
              {entry.kind === "directory" ? (
                <button
                  type="button"
                  onClick={() => loadDirectory(entry.path)}
                  className="min-w-0 flex-1 truncate text-left font-medium text-emerald-700 underline"
                >
                  {entry.name}/
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              )}
              <span className="text-xs text-neutral-400">
                {entry.size === null
                  ? "folder"
                  : `${entry.size.toLocaleString()} B`}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-4 rounded border border-neutral-200 p-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium">
            Add imported files to album
          </span>
          <select
            value={albumId}
            onChange={(event) => setAlbumId(event.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2"
          >
            <option value="">No album</option>
            <option value="__new__">Create a new album…</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.name}
              </option>
            ))}
          </select>
          {albumId === "__new__" ? (
            <input
              type="text"
              value={newAlbumName}
              onChange={(event) => setNewAlbumName(event.target.value)}
              placeholder="New album name"
              className="mt-2 w-full rounded border border-neutral-300 px-3 py-2"
            />
          ) : null}
        </label>
        <label className="flex items-center gap-2 self-end rounded border border-neutral-200 px-3 py-2">
          <input
            type="checkbox"
            checked={isShareAll}
            onChange={(event) => setIsShareAll(event.target.checked)}
          />
          Generate public share links for all files
        </label>
        <button
          type="button"
          disabled={isQueueing || selectedPaths.size === 0}
          onClick={queueImport}
          className="rounded border border-emerald-500 px-4 py-2 text-emerald-700 disabled:opacity-40 sm:col-span-2"
        >
          {isQueueing
            ? "Queueing…"
            : `Import ${selectedPaths.size} selected item${selectedPaths.size === 1 ? "" : "s"}`}
        </button>
      </section>
      {error ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </p>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-medium">Import jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-xs text-neutral-500">No imports yet.</p>
        ) : null}
        {jobs.map((job) => (
          <article
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-200 p-3"
          >
            <div>
              <div className="font-medium">{job.status}</div>
              <div className="text-xs text-neutral-500">
                {job.completedFiles}/{job.totalFiles || "?"} imported ·{" "}
                {job.failedFiles} failed
              </div>
              {job.error ? (
                <div className="mt-1 text-xs text-red-600">{job.error}</div>
              ) : null}
            </div>
            {job.status === "pending" || job.status === "processing" ? (
              <button
                type="button"
                onClick={() => cancelJob(job.id)}
                className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700"
              >
                Cancel
              </button>
            ) : job.status === "failed" ||
              job.status === "cancelled" ||
              (job.status === "complete" && job.failedFiles > 0) ? (
              <button
                type="button"
                onClick={() => retryJob(job.id)}
                className="rounded border border-emerald-300 px-3 py-1.5 text-xs text-emerald-700"
              >
                Retry failed files
              </button>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
};

export default NodeImportClient;
