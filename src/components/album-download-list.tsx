"use client";

import { useState } from "react";
import { LightDownload } from "@energiz3r/icon-library/Icons/Light/LightDownload";
import { getFileIconForExtension } from "@/lib/FileIconHelper";
import { downloadFileNameForMedia } from "@/lib/download-file-name";
import type { MediaKind } from "@/lib/media-types";

export type AlbumDownloadListItem = {
  id: string;
  kind: MediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  mimeType?: string;
  content?: string;
  albumCaption?: string;
  sizeOriginal?: number;
};

const formatBytes = (bytes?: number): string => {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0) {
    return "";
  }
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const secondaryLabelForItem = (item: AlbumDownloadListItem): string => {
  if (item.albumCaption) {
    return item.albumCaption;
  }
  const sizeLabel = formatBytes(item.sizeOriginal);
  if (sizeLabel) {
    return sizeLabel;
  }
  return item.kind;
};

const downloadHrefForItem = (
  item: AlbumDownloadListItem,
  shareId?: string,
): string | null => {
  if (item.kind === "note") {
    return null;
  }
  if (shareId) {
    return `/share/album/${shareId}/media/${item.kind}/${item.id}/${item.baseName}.${item.ext}?download=true`;
  }
  return `/media/${item.kind}/${item.id}/${item.baseName}.${item.ext}?download=true`;
};

export const AlbumDownloadList = ({
  items,
  shareId,
}: {
  items: AlbumDownloadListItem[];
  shareId?: string;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [downloadingNoteId, setDownloadingNoteId] = useState<string | null>(
    null,
  );

  const downloadNote = async (item: AlbumDownloadListItem) => {
    const fileName = downloadFileNameForMedia(item);
    setError(null);
    setDownloadingNoteId(item.id);
    try {
      if (typeof item.content === "string") {
        triggerBlobDownload(
          new Blob([item.content], { type: "text/markdown;charset=utf-8" }),
          fileName,
        );
        return;
      }
      const response = await fetch(`/api/notes/${encodeURIComponent(item.id)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        note?: { content?: string };
      };
      if (!response.ok || typeof payload.note?.content !== "string") {
        throw new Error(payload.error ?? "Unable to download note.");
      }
      triggerBlobDownload(
        new Blob([payload.note.content], {
          type: "text/markdown;charset=utf-8",
        }),
        fileName,
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download note.",
      );
    } finally {
      setDownloadingNoteId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-neutral-500">
        No files in this album.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
        {items.map(item => {
          const fileName = downloadFileNameForMedia(item);
          const href = downloadHrefForItem(item, shareId);
          const Icon = getFileIconForExtension(item.ext);

          return (
            <li
              key={`${item.kind}:${item.id}`}
              className="flex items-center gap-3 px-3 py-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-neutral-200 bg-neutral-50 text-neutral-500">
                <Icon
                  className="h-5 w-5"
                  fill="currentColor"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-neutral-900">
                  {fileName}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {secondaryLabelForItem(item)}
                </div>
              </div>
              {href ? (
                <a
                  href={href}
                  download={fileName}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50"
                  aria-label={`Download ${fileName}`}
                  title={`Download ${fileName}`}
                >
                  <LightDownload
                    className="h-4 w-4"
                    fill="currentColor"
                  />
                  download
                </a>
              ) : (
                <button
                  type="button"
                  disabled={downloadingNoteId === item.id}
                  onClick={() => {
                    void downloadNote(item);
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50"
                  aria-label={`Download ${fileName}`}
                  title={`Download ${fileName}`}
                >
                  <LightDownload
                    className="h-4 w-4"
                    fill="currentColor"
                  />
                  {downloadingNoteId === item.id ? "…" : "download"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
