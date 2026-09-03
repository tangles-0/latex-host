"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { LightEye } from "@energiz3r/icon-library/Icons/Light/LightEye";
import { LightEyeSlash } from "@energiz3r/icon-library/Icons/Light/LightEyeSlash";
import { LightImages } from "@energiz3r/icon-library/Icons/Light/LightImages";
import { LightLink } from "@energiz3r/icon-library/Icons/Light/LightLink";
import { LightThList } from "@energiz3r/icon-library/Icons/Light/LightThList";
import { LightUnlink } from "@energiz3r/icon-library/Icons/Light/LightUnlink";
import { useShareLinkFormat } from "@/hooks/use-share-link-format";
import { formatShareUrl, type NodeShareContext } from "@/lib/share-link-format";

const optionCardClass =
  "flex flex-col overflow-hidden rounded border border-neutral-200";
const optionBarClass = "border-b px-3 py-1.5 text-xs font-medium";
const optionBarDefaultClass =
  "border-neutral-200 bg-neutral-50 text-neutral-600";
const optionBodyClass = "flex flex-1 flex-col gap-3 px-3 py-3";
const outlineButtonClass =
  "tile-control rounded px-3 py-1 text-xs disabled:opacity-50";

export default function AlbumShareControls({
  albumId,
  isDisplayAsDownloadPage: initialDisplayAsDownloadPage,
  isDisplayAsCompactView: initialDisplayAsCompactView,
  nodeShareContext,
}: {
  albumId: string;
  isDisplayAsDownloadPage: boolean;
  isDisplayAsCompactView: boolean;
  nodeShareContext?: NodeShareContext | null;
}) {
  const router = useRouter();
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isDisplayAsDownloadPage, setIsDisplayAsDownloadPage] = useState(
    initialDisplayAsDownloadPage,
  );
  const [isDisplayAsCompactView, setIsDisplayAsCompactView] = useState(
    initialDisplayAsCompactView,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSavingDisplayMode, setIsSavingDisplayMode] = useState(false);

  const [shareLinkFormat] = useShareLinkFormat(Boolean(nodeShareContext));
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullShareUrl = shareUrl
    ? formatShareUrl(shareUrl, shareLinkFormat, nodeShareContext, origin)
    : "";

  useEffect(() => {
    setIsDisplayAsDownloadPage(initialDisplayAsDownloadPage);
  }, [initialDisplayAsDownloadPage]);

  useEffect(() => {
    setIsDisplayAsCompactView(initialDisplayAsCompactView);
  }, [initialDisplayAsCompactView]);

  useEffect(() => {
    let isMounted = true;

    async function loadShare() {
      const response = await fetch(`/api/album-shares?albumId=${albumId}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as
        | { share: { id: string }; url?: string }
        | { share: null };
      if (!isMounted) {
        return;
      }
      if ("share" in payload && payload.share && payload.url) {
        setShareEnabled(true);
        setShareUrl(payload.url);
      }
    }

    void loadShare();
    return () => {
      isMounted = false;
    };
  }, [albumId]);

  async function enableShares() {
    setError(null);
    const response = await fetch("/api/album-shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to enable album share.");
      return;
    }

    const payload = (await response.json()) as { url: string };
    setShareUrl(payload.url);
    setShareEnabled(true);
  }

  async function disableShares() {
    setError(null);
    await fetch("/api/album-shares", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId }),
    });
    setShareUrl(null);
    setShareEnabled(false);
  }

  async function copyLink() {
    if (!shareUrl) {
      return;
    }
    await navigator.clipboard.writeText(fullShareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function patchDisplayFlags(updates: {
    displayAsDownloadPage?: boolean;
    displayAsCompactView?: boolean;
  }) {
    setError(null);
    setIsSavingDisplayMode(true);
    try {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Unable to update album display mode.");
        return false;
      }
      if (typeof updates.displayAsDownloadPage === "boolean") {
        setIsDisplayAsDownloadPage(updates.displayAsDownloadPage);
      }
      if (typeof updates.displayAsCompactView === "boolean") {
        setIsDisplayAsCompactView(updates.displayAsCompactView);
      }
      router.refresh();
      return true;
    } finally {
      setIsSavingDisplayMode(false);
    }
  }

  const layoutButtonClass = (isActive: boolean) =>
    clsx(
      "inline-flex h-16 w-16 items-center justify-center rounded disabled:opacity-50",
      isActive ? "bg-black text-white" : "tile-control",
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-stretch gap-3">
        <section className={clsx(optionCardClass, "w-fit shrink-0")}>
          <h2 className={clsx(optionBarClass, optionBarDefaultClass)}>
            view mode
          </h2>
          <div className={optionBodyClass}>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                disabled={isSavingDisplayMode}
                aria-pressed={!isDisplayAsCompactView}
                aria-label="Tiles view"
                title="Tiles view"
                onClick={() => {
                  if (!isDisplayAsCompactView) {
                    return;
                  }
                  void patchDisplayFlags({ displayAsCompactView: false });
                }}
                className={layoutButtonClass(!isDisplayAsCompactView)}
              >
                <LightImages className="h-8 w-8" fill="currentColor" />
              </button>
              <button
                type="button"
                disabled={isSavingDisplayMode}
                aria-pressed={isDisplayAsCompactView}
                aria-label="List view"
                title="List view"
                onClick={() => {
                  if (isDisplayAsCompactView) {
                    return;
                  }
                  void patchDisplayFlags({ displayAsCompactView: true });
                }}
                className={layoutButtonClass(isDisplayAsCompactView)}
              >
                <LightThList className="h-8 w-8" fill="currentColor" />
              </button>
            </div>
            <span className="text-neutral-600 text-xs">
              applies to shared view too
            </span>
          </div>
        </section>

        <section className={clsx(optionCardClass, "w-fit shrink-0")}>
          <h2 className={clsx(optionBarClass, optionBarDefaultClass)}>
            download links
          </h2>
          <div className={optionBodyClass}>
            <button
              type="button"
              disabled={isSavingDisplayMode}
              aria-pressed={isDisplayAsDownloadPage}
              aria-label={
                isDisplayAsDownloadPage
                  ? "Hide download links"
                  : "Show download links"
              }
              title={
                isDisplayAsDownloadPage
                  ? "Hide download links"
                  : "Show download links"
              }
              onClick={() => {
                void patchDisplayFlags({
                  displayAsDownloadPage: !isDisplayAsDownloadPage,
                });
              }}
              className={layoutButtonClass(isDisplayAsDownloadPage)}
            >
              {isDisplayAsDownloadPage ? (
                <LightEye className="h-8 w-8" fill="currentColor" />
              ) : (
                <LightEyeSlash className="h-8 w-8" fill="currentColor" />
              )}
            </button>
          </div>
        </section>

        <section
          className={clsx(
            optionCardClass,
            "min-w-0 flex-1 basis-full sm:basis-0",
          )}
        >
          <h2
            className={clsx(
              optionBarClass,
              shareEnabled
                ? "border-emerald-600 bg-emerald-600 text-white"
                : optionBarDefaultClass,
            )}
          >
            {shareEnabled ? "sharing enabled" : "sharing disabled"}
          </h2>
          <div className={optionBodyClass}>
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-pressed={shareEnabled}
                aria-label={
                  shareEnabled
                    ? "Disable album sharing"
                    : "Enable album sharing"
                }
                title={
                  shareEnabled
                    ? "Disable album sharing"
                    : "Enable album sharing"
                }
                onClick={() => {
                  void (shareEnabled ? disableShares() : enableShares());
                }}
                className={layoutButtonClass(shareEnabled)}
              >
                {shareEnabled ? (
                  <LightLink className="h-8 w-8" fill="currentColor" />
                ) : (
                  <LightUnlink className="h-8 w-8" fill="currentColor" />
                )}
              </button>
              {shareEnabled && shareUrl ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
                  <span className="break-all font-bold">{fullShareUrl}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {copied ? (
                      <span className="text-emerald-600">Copied</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className={outlineButtonClass}
                    >
                      copy url
                    </button>
                    <a
                      href={fullShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={clsx(
                        outlineButtonClass,
                        "inline-flex items-center",
                      )}
                    >
                      open
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
