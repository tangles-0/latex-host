"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AlbumShareControls({
  albumId,
  isDisplayAsDownloadPage: initialDisplayAsDownloadPage,
}: {
  albumId: string;
  isDisplayAsDownloadPage: boolean;
}) {
  const router = useRouter();
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isDisplayAsDownloadPage, setIsDisplayAsDownloadPage] = useState(
    initialDisplayAsDownloadPage,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSavingDisplayMode, setIsSavingDisplayMode] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    setIsDisplayAsDownloadPage(initialDisplayAsDownloadPage);
  }, [initialDisplayAsDownloadPage]);

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
    await navigator.clipboard.writeText(`${origin}${shareUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function toggleDisplayAsDownloadPage() {
    const nextValue = !isDisplayAsDownloadPage;
    setError(null);
    setIsSavingDisplayMode(true);
    try {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayAsDownloadPage: nextValue }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Unable to update album display mode.");
        return;
      }
      setIsDisplayAsDownloadPage(nextValue);
      router.refresh();
    } finally {
      setIsSavingDisplayMode(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded border border-neutral-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-neutral-600">sharing:</span>
          {shareEnabled ? (
            <span className="rounded bg-emerald-600 px-2 py-1 font-medium text-white">
              album shared
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void (shareEnabled ? disableShares() : enableShares());
            }}
            className={`rounded px-3 py-1 text-xs ${
              shareEnabled ? "bg-black text-white" : "border border-neutral-200"
            }`}
          >
            {shareEnabled ? "disable" : "enable"}
          </button>
        </div>

        {shareEnabled && shareUrl ? (
          <div className="text-xs">
            <div
              className="flex flex-wrap items-center justify-between gap-3"
              onClick={() => void copyLink()}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <span className="text-neutral-600">album link: </span>
                <span className="break-all text-xs font-bold">
                  {origin}
                  {shareUrl}
                </span>
                {copied ? (
                  <span className="ml-2 text-emerald-600">Copied</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded border border-neutral-200 px-3 py-1 text-xs"
              >
                copy link{" "}
                {copied ? (
                  <span className="ml-2 text-emerald-600">kk</span>
                ) : null}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-2 text-xs">
          <span className="text-neutral-600">display as download page:</span>
          {isDisplayAsDownloadPage ? (
            <span className="rounded bg-neutral-800 px-2 py-1 font-medium text-white">
              list + download
            </span>
          ) : null}
          <button
            type="button"
            disabled={isSavingDisplayMode}
            onClick={() => {
              void toggleDisplayAsDownloadPage();
            }}
            className={`rounded px-3 py-1 text-xs disabled:opacity-50 ${
              isDisplayAsDownloadPage
                ? "bg-black text-white"
                : "border border-neutral-200"
            }`}
          >
            {isDisplayAsDownloadPage ? "disable" : "enable"}
          </button>
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
