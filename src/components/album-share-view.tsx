"use client";

import { useState } from "react";
import clsx from "clsx";
import { AlbumMediaDownloadButton } from "@/components/album-media-download-button";
import { AlbumShareLightbox } from "@/components/album-share-lightbox";
import { albumShareMediaUrls } from "@/lib/album-share-media";
import NoteMarkdown from "@/components/note-markdown";
import { renderFileIconForExtension } from "@/lib/FileIconHelper";
import type { MediaKind } from "@/lib/media-types";

type AlbumMedia = {
  id: string;
  kind: MediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  mimeType: string;
  width?: number;
  height?: number;
  previewStatus?: "pending" | "started" | "complete" | "error";
  albumCaption?: string;
  uploadedAt: string;
  content?: string;
  sizeOriginal?: number;
};

export default function AlbumShareView({
  shareId,
  albumName,
  media,
  isDisplayAsDownloadPage = false,
  isDisplayAsCompactView = false,
}: {
  shareId: string;
  albumName: string;
  media: AlbumMedia[];
  isDisplayAsDownloadPage?: boolean;
  isDisplayAsCompactView?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const formatTimestamp = (value: string) =>
    `${new Date(value).toISOString().replace("T", " ").slice(0, 19)} UTC`;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-2 px-2 py-2 text-sm sm:gap-6 sm:px-6 sm:py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{albumName}</h1>
        <p className="text-neutral-600">
          {media.length} file{media.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className={clsx(isDisplayAsCompactView ? "space-y-2" : "space-y-6")}>
        {media.map((item, index) => {
          const { previewUrl } = albumShareMediaUrls(shareId, item);
          const previewExt = item.kind === "image" ? item.ext : "png";
          const thumbUrl = `/share/album/${shareId}/media/${item.kind}/${item.id}/${item.baseName}-sm.${previewExt}`;
          const displayName = item.originalFileName ?? item.baseName;
          const hasPreviewImage =
            (item.kind === "image" ||
              item.kind === "video" ||
              item.kind === "document") &&
            item.previewStatus === "complete";

          return (
            <div
              key={item.id}
              className={clsx(
                "rounded-md border border-neutral-200 text-left",
                isDisplayAsCompactView ? "flex items-stretch gap-3 p-2" : "p-4",
              )}
            >
              {item.kind === "note" && !isDisplayAsCompactView ? (
                <div
                  className="cursor-pointer rounded border border-neutral-200 p-4"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) {
                      return;
                    }
                    setActiveIndex(index);
                  }}
                >
                  <NoteMarkdown content={item.content ?? ""} />
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={`Open ${displayName}`}
                  onClick={() => setActiveIndex(index)}
                  className={clsx(
                    "cursor-pointer text-left",
                    isDisplayAsCompactView ? "shrink-0" : "block w-full",
                  )}
                >
                  {item.kind === "note" ? (
                    <div className="flex h-20 w-20 flex-col justify-between rounded border border-neutral-200 bg-neutral-50 p-2">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                        note
                      </div>
                    </div>
                  ) : isDisplayAsCompactView ? (
                    hasPreviewImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={thumbUrl}
                        alt=""
                        className="h-20 w-20 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50">
                        {renderFileIconForExtension(item.ext, {
                          className: "h-6 w-6 text-neutral-500",
                          fill: "currentColor",
                        })}
                      </div>
                    )
                  ) : hasPreviewImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewUrl}
                      alt=""
                      className="w-full rounded border border-neutral-200 object-contain"
                    />
                  ) : (
                    <div className="flex min-h-[160px] w-full items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50">
                      {renderFileIconForExtension(item.ext, {
                        className: "h-12 w-12 text-neutral-500",
                        fill: "currentColor",
                      })}
                    </div>
                  )}
                </button>
              )}
              <div
                className={clsx(
                  "flex items-start gap-2",
                  isDisplayAsCompactView
                    ? "min-w-0 flex-1 items-center py-1"
                    : "mt-3",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => setActiveIndex(index)}
                >
                  <div className="text-xs text-neutral-500">
                    {item.width && item.height
                      ? `${item.width}×${item.height} • `
                      : ""}
                    {formatTimestamp(item.uploadedAt)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-700">
                    {displayName}
                  </div>
                  {item.albumCaption ? (
                    <p className="mt-2 text-xs text-neutral-700">
                      {item.albumCaption}
                    </p>
                  ) : null}
                </button>
                {isDisplayAsDownloadPage ? (
                  <AlbumMediaDownloadButton item={item} shareId={shareId} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {activeIndex !== null ? (
        <AlbumShareLightbox
          items={media}
          activeIndex={activeIndex}
          shareId={shareId}
          onClose={() => setActiveIndex(null)}
          onChangeIndex={setActiveIndex}
        />
      ) : null}
    </main>
  );
}
