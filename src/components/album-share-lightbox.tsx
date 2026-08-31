"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { LightCaretLeft } from "@energiz3r/icon-library/Icons/Light/LightCaretLeft";
import { LightCaretRight } from "@energiz3r/icon-library/Icons/Light/LightCaretRight";
import { LightCompress } from "@energiz3r/icon-library/Icons/Light/LightCompress";
import { LightExpand } from "@energiz3r/icon-library/Icons/Light/LightExpand";
import { LightTimes } from "@energiz3r/icon-library/Icons/Light/LightTimes";
import CodeFileEditor from "@/components/code-file-editor";
import NoteMarkdown from "@/components/note-markdown";
import {
  albumShareMediaUrls,
  isAlbumShareLightboxTextItem,
  type AlbumShareMediaItem,
} from "@/lib/album-share-media";
import {
  isAudioExtension,
  renderFileIconForExtension,
} from "@/lib/FileIconHelper";

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
const LIGHTBOX_CONTROLS_HIDE_MS = 3000;

export type AlbumShareLightboxItem = AlbumShareMediaItem;

const isMarkdownExtension = (ext: string) =>
  MARKDOWN_EXTENSIONS.has(ext.toLowerCase());

const navButtonClass =
  "tile-control absolute top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full transition-opacity duration-300";

const useAlbumShareLightboxControls = (resetKey: number) => {
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [idleNonce, setIdleNonce] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAreControlsVisible(false);
    }, LIGHTBOX_CONTROLS_HIDE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [idleNonce, resetKey]);

  const revealControls = () => {
    setAreControlsVisible(true);
    setIdleNonce((current) => current + 1);
  };

  return { areControlsVisible, revealControls };
};

const AlbumShareLightboxIconStage = ({ children }: { children: ReactNode }) => (
  <div className="album-share-lightbox-icon-stage flex flex-col items-center justify-center gap-3">
    {children}
  </div>
);

const AlbumShareLightboxImage = ({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="flex max-h-full min-h-48 w-full flex-1 flex-col items-center justify-center">
      {isLoaded ? null : (
        <div className="text-sm text-neutral-200" role="status">
          Loading image...
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => {
          setIsLoaded(true);
        }}
        onError={() => {
          setIsLoaded(true);
        }}
        className={clsx(
          "max-h-full max-w-full object-contain",
          isLoaded ? null : "hidden",
        )}
      />
    </div>
  );
};

const AlbumShareLightboxText = ({
  item,
  shareId,
}: {
  item: AlbumShareLightboxItem;
  shareId: string;
}) => {
  const initialContent = typeof item.content === "string" ? item.content : null;
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(initialContent === null);
  const isMarkdown = item.kind === "note" || isMarkdownExtension(item.ext);

  useEffect(() => {
    if (initialContent !== null) {
      return;
    }
    let isCancelled = false;
    const { fullUrl } = albumShareMediaUrls(shareId, item);
    void fetch(fullUrl, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load file.");
        }
        return response.text();
      })
      .then((content) => {
        if (!isCancelled) {
          setFetchedContent(content);
          setIsLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load file.",
          );
          setIsLoading(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [initialContent, item, shareId]);

  if (isLoading) {
    return <div className="text-sm text-neutral-300">Loading file...</div>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  const textContent = initialContent ?? fetchedContent ?? "";
  if (isMarkdown) {
    return (
      <div className="h-full min-h-0 w-full overflow-y-auto bg-white p-6 text-neutral-900">
        <NoteMarkdown content={textContent} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <CodeFileEditor
        value={textContent}
        onChange={() => undefined}
        ext={item.ext}
        readOnly
        layoutMode="fullscreen"
      />
    </div>
  );
};

export const AlbumShareLightbox = ({
  items,
  activeIndex,
  shareId,
  onClose,
  onChangeIndex,
}: {
  items: AlbumShareLightboxItem[];
  activeIndex: number;
  shareId: string;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { areControlsVisible, revealControls } =
    useAlbumShareLightboxControls(activeIndex);
  const item = items[activeIndex];
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < items.length - 1;
  const hiddenControlClass = areControlsVisible
    ? "opacity-100"
    : "pointer-events-none opacity-0";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (!item) {
    return null;
  }

  const urls = albumShareMediaUrls(shareId, item);
  const displayName = item.originalFileName ?? item.baseName;
  const isAudio =
    item.mimeType.toLowerCase().startsWith("audio/") ||
    isAudioExtension(item.ext);
  const isTextItem = isAlbumShareLightboxTextItem(item);
  const hasIconBackdrop =
    isAudio ||
    (item.kind !== "image" &&
      item.kind !== "video" &&
      !isTextItem &&
      !(item.kind === "document" && item.previewStatus === "complete"));

  const closeLightbox = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
    onClose();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void rootRef.current?.requestFullscreen();
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={displayName}
      tabIndex={-1}
      className={clsx(
        "album-share-lightbox fixed inset-0 z-50 flex outline-none",
        hasIconBackdrop ? "album-share-lightbox--icon" : null,
      )}
      onPointerDown={revealControls}
      onClick={closeLightbox}
      onKeyDown={(event) => {
        revealControls();
        if (event.key === "Escape") {
          event.preventDefault();
          closeLightbox();
        }
        if (event.key === "ArrowLeft" && hasPrevious) {
          event.preventDefault();
          onChangeIndex(activeIndex - 1);
        }
        if (event.key === "ArrowRight" && hasNext) {
          event.preventDefault();
          onChangeIndex(activeIndex + 1);
        }
      }}
    >
      {hasPrevious ? (
        <button
          type="button"
          aria-label="Previous file"
          title="Previous file"
          className={clsx(navButtonClass, "left-3", hiddenControlClass)}
          onClick={(event) => {
            event.stopPropagation();
            onChangeIndex(activeIndex - 1);
          }}
        >
          <LightCaretLeft className="h-6 w-6" fill="currentColor" />
        </button>
      ) : null}
      {hasNext ? (
        <button
          type="button"
          aria-label="Next file"
          title="Next file"
          className={clsx(navButtonClass, "right-3", hiddenControlClass)}
          onClick={(event) => {
            event.stopPropagation();
            onChangeIndex(activeIndex + 1);
          }}
        >
          <LightCaretRight className="h-6 w-6" fill="currentColor" />
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Close"
        title="Close"
        className={clsx(
          "tile-control absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded transition-opacity duration-300",
          hiddenControlClass,
        )}
        onClick={(event) => {
          event.stopPropagation();
          closeLightbox();
        }}
      >
        <LightTimes className="h-5 w-5" fill="currentColor" />
      </button>

      <div
        className={clsx(
          "relative z-[1] flex h-full min-h-0 w-full flex-col",
          isTextItem ? null : "items-center justify-center",
        )}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div
          className={clsx(
            "flex h-full min-h-0 w-full flex-col",
            isTextItem ? null : "items-center justify-center",
            item.kind === "image" ||
              item.kind === "video" ||
              hasIconBackdrop ||
              isTextItem
              ? "max-w-full"
              : "max-w-5xl p-4",
          )}
        >
          {item.kind === "image" ? (
            <AlbumShareLightboxImage
              key={urls.fullUrl}
              src={urls.fullUrl}
              alt={displayName}
            />
          ) : item.kind === "video" ? (
            <video
              key={item.id}
              src={urls.fullUrl}
              controls
              playsInline
              poster={
                item.previewStatus === "complete" ? urls.previewUrl : undefined
              }
              className="max-h-full max-w-full rounded bg-black object-contain"
            />
          ) : isTextItem ? (
            <AlbumShareLightboxText
              key={item.id}
              item={item}
              shareId={shareId}
            />
          ) : item.kind === "document" && item.previewStatus === "complete" ? (
            <AlbumShareLightboxImage
              key={urls.previewUrl}
              src={urls.previewUrl}
              alt={`${displayName} preview`}
            />
          ) : isAudio ? (
            <AlbumShareLightboxIconStage>
              {renderFileIconForExtension(item.ext, {
                className: "h-20 w-20",
                fill: "currentColor",
              })}
              <audio
                key={item.id}
                src={urls.fullUrl}
                controls
                className="w-full max-w-sm"
                preload="metadata"
              />
            </AlbumShareLightboxIconStage>
          ) : (
            <AlbumShareLightboxIconStage>
              {renderFileIconForExtension(item.ext, {
                className: "h-20 w-20",
                fill: "currentColor",
              })}
              <span className="text-sm">{displayName}</span>
            </AlbumShareLightboxIconStage>
          )}
        </div>
      </div>

      <div
        className={clsx(
          "pointer-events-none absolute bottom-20 left-1/2 z-20 max-w-[min(80%,40rem)] -translate-x-1/2 truncate text-center text-xs text-neutral-200 transition-opacity duration-300",
          hiddenControlClass,
        )}
      >
        {displayName}
      </div>

      <button
        type="button"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className={clsx(
          "tile-control absolute bottom-4 left-1/2 z-20 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full transition-opacity duration-300",
          hiddenControlClass,
        )}
        onClick={(event) => {
          event.stopPropagation();
          toggleFullscreen();
        }}
      >
        {isFullscreen ? (
          <LightCompress className="h-6 w-6" fill="currentColor" />
        ) : (
          <LightExpand className="h-6 w-6" fill="currentColor" />
        )}
      </button>
    </div>
  );
};
