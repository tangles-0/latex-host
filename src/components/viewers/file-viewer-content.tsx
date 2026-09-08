"use client";

import { LightClock } from "@energiz3r/icon-library/Icons/Light/LightClock";
import {
  isArchiveExtension,
  isAudioExtension,
  renderFileIconForExtension,
} from "@/lib/FileIconHelper";

export function FileViewerContent({
  kind,
  previewStatus,
  fullUrl,
  previewUrl,
  ext,
  mimeType,
}: {
  kind: "video" | "document" | "other";
  previewStatus?: "pending" | "started" | "complete" | "error";
  fullUrl: string;
  previewUrl: string;
  ext?: string;
  mimeType?: string;
}) {
  const iconClass = "h-12 w-12 text-neutral-500";

  if (kind === "video") {
    return (
      <div className="space-y-2">
        <video
          src={fullUrl}
          controls
          className="sm:max-h-[60vh] w-full rounded border border-neutral-200 object-contain"
          poster={previewStatus === "complete" ? previewUrl : undefined}
        />
        {previewStatus === "pending" ? (
          <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <LightClock className="h-4 w-4" fill="currentColor" />
              <span>preview pending</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  if (kind === "document") {
    if (previewStatus !== "complete") {
      return (
        <div className="flex sm:max-h-[60vh] min-h-[320px] w-full items-center justify-center rounded border border-neutral-200 bg-neutral-50">
          {renderFileIconForExtension(ext, {
            className: iconClass,
            fill: "currentColor",
          })}
        </div>
      );
    }
    return (
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Document preview"
          className="sm:max-h-[60vh] w-full rounded border border-neutral-200 object-contain"
        />
      </a>
    );
  }
  const isAudio =
    (mimeType ?? "").toLowerCase().startsWith("audio/") ||
    isAudioExtension(ext);
  if (isAudio) {
    return (
      <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center justify-center">
          {renderFileIconForExtension(ext, {
            className: iconClass,
            fill: "currentColor",
          })}
        </div>
        <audio src={fullUrl} controls className="w-full" preload="metadata" />
      </div>
    );
  }
  const downloadLabel = isArchiveExtension(ext)
    ? "Download archive"
    : "Download file";
  return (
    <a
      href={fullUrl}
      download
      className="flex sm:max-h-[60vh] min-h-[320px] w-full items-center justify-center rounded border border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
      aria-label={downloadLabel}
      title={downloadLabel}
    >
      {renderFileIconForExtension(ext, {
        className: iconClass,
        fill: "currentColor",
      })}
    </a>
  );
}
