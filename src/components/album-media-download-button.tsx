"use client";

import { useState } from "react";
import { LightDownload } from "@energiz3r/icon-library/Icons/Light/LightDownload";
import {
  albumMediaDownloadHref,
  triggerBlobDownload,
} from "@/lib/album-download";
import { downloadFileNameForMedia } from "@/lib/download-file-name";
import type { MediaKind } from "@/lib/media-types";

export type AlbumMediaDownloadItem = {
  id: string;
  kind: MediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  content?: string;
};

export const AlbumMediaDownloadButton = ({
  item,
  shareId,
  className = "tile-control inline-flex shrink-0 items-center gap-1 rounded px-3 py-1.5 text-xs disabled:opacity-50",
}: {
  item: AlbumMediaDownloadItem;
  shareId?: string;
  className?: string;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingNote, setIsDownloadingNote] = useState(false);
  const fileName = downloadFileNameForMedia(item);
  const href = albumMediaDownloadHref(item, shareId);

  const downloadNote = async () => {
    setError(null);
    setIsDownloadingNote(true);
    try {
      if (typeof item.content === "string") {
        triggerBlobDownload(
          new Blob([item.content], { type: "text/markdown;charset=utf-8" }),
          fileName,
        );
        return;
      }
      const response = await fetch(
        `/api/notes/${encodeURIComponent(item.id)}`,
        {
          cache: "no-store",
        },
      );
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
      setIsDownloadingNote(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {href ? (
        <a
          href={href}
          download={fileName}
          className={className}
          aria-label={`Download ${fileName}`}
          title={`Download ${fileName}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <LightDownload className="h-4 w-4" fill="currentColor" />
          download
        </a>
      ) : (
        <button
          type="button"
          disabled={isDownloadingNote}
          onClick={(event) => {
            event.stopPropagation();
            void downloadNote();
          }}
          className={className}
          aria-label={`Download ${fileName}`}
          title={`Download ${fileName}`}
        >
          <LightDownload className="h-4 w-4" fill="currentColor" />
          {isDownloadingNote ? "…" : "download"}
        </button>
      )}
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
};
