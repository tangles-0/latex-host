"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import clsx from "clsx";
import { LightFileImage } from "@energiz3r/icon-library/Icons/Light/LightFileImage";

import { ImageGenerationMaskEditor } from "@/components/image-generation-mask-editor";
import {
  defaultDenoisingStrength,
  denoisingStrengthLabel,
  imageGenerationRetryInput,
  maxDenoisingStrength,
  minDenoisingStrength,
} from "@/lib/image-generations/img2img";
import type { ImageGenerationEntry } from "@/lib/image-generations/types";
import type { MediaEntry } from "@/lib/media-store";

const pollIntervalMs = 2_000;
const denoisingPresets = [
  { value: 0.25, label: "subtle" },
  { value: 0.5, label: "restyle" },
  { value: 0.75, label: "replace" },
] as const;

const isActiveStatus = (status: ImageGenerationEntry["status"]) =>
  status === "pending" || status === "generating" || status === "uploading";

const formatStatus = (status: ImageGenerationEntry["status"]) => {
  if (status === "pending") {
    return "queued";
  }

  return status;
};

const sourceThumbnailUrl = (media: MediaEntry) =>
  `/media/image/${media.id}/${media.baseName}-sm.${media.ext}`;

const sourceImageUrl = (media: MediaEntry) =>
  `/media/image/${media.id}/${media.baseName}.${media.ext}`;

export const ImageGenerationStudio = ({
  hasAccess,
}: {
  hasAccess: boolean;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceMediaId = searchParams.get("source")?.trim() || undefined;
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [expandPrompt, setExpandPrompt] = useState(false);
  const [denoisingStrength, setDenoisingStrength] = useState(
    defaultDenoisingStrength,
  );
  const [maskPngBase64, setMaskPngBase64] = useState<string | null>(null);
  const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
  const [sourceMedia, setSourceMedia] = useState<MediaEntry | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [generations, setGenerations] = useState<ImageGenerationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [busyGenerationId, setBusyGenerationId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"keep" | "discard" | "retry" | null>(
    null,
  );
  const [lightbox, setLightbox] = useState<{
    url: string;
    alt: string;
  } | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const completedIdsRef = useRef(new Set<string>());
  const hasActiveGenerations = useMemo(
    () => generations.some((generation) => isActiveStatus(generation.status)),
    [generations],
  );
  const isImg2Img = Boolean(sourceMedia);

  const loadGenerations = useCallback(async () => {
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    try {
      const response = await fetch("/api/image-generations", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        generations?: ImageGenerationEntry[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load image generations.");
      }

      const nextGenerations = payload.generations ?? [];
      const completedIds = new Set(
        nextGenerations
          .filter(
            (generation) =>
              generation.status === "complete" && Boolean(generation.mediaId),
          )
          .map((generation) => generation.id),
      );

      if (
        hasLoadedRef.current &&
        [...completedIds].some((id) => !completedIdsRef.current.has(id))
      ) {
        router.refresh();
      }

      hasLoadedRef.current = true;
      completedIdsRef.current = completedIds;
      setGenerations(nextGenerations);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load image generations.",
      );
    } finally {
      isLoadingRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    void loadGenerations();
  }, [loadGenerations]);

  useEffect(() => {
    if (!sourceMediaId) {
      setSourceMedia(null);
      setSourceError(null);
      setMaskPngBase64(null);
      return;
    }

    let isCancelled = false;
    const loadSource = async () => {
      setSourceError(null);
      try {
        const response = await fetch(
          `/api/media?kind=image&mediaId=${encodeURIComponent(sourceMediaId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          media?: MediaEntry;
          error?: string;
        };
        if (!response.ok || !payload.media) {
          throw new Error(payload.error ?? "Source image not found.");
        }
        if (!isCancelled) {
          setSourceMedia(payload.media);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setSourceMedia(null);
          setSourceError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the selected image.",
          );
        }
      }
    };

    void loadSource();
    return () => {
      isCancelled = true;
    };
  }, [sourceMediaId]);

  useEffect(() => {
    if (!hasActiveGenerations) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadGenerations();
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [hasActiveGenerations, loadGenerations]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && lightbox) {
        setLightbox(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox]);

  const clearSource = () => {
    setMaskPngBase64(null);
    setSourceMedia(null);
    router.replace("/generate");
  };

  const queueGeneration = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/image-generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      generation?: ImageGenerationEntry;
      error?: string;
    };

    if (payload.generation) {
      setGenerations((current) => [
        payload.generation as ImageGenerationEntry,
        ...current.filter((item) => item.id !== payload.generation?.id),
      ]);
    }

    if (!response.ok || !payload.generation) {
      throw new Error(payload.error ?? "Unable to generate image.");
    }
  };

  const submitGeneration = async () => {
    if (!hasAccess) {
      setError(
        "you do not have access to image generation - please request it",
      );
      return;
    }

    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      setError("Prompt is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await queueGeneration({
        prompt: normalizedPrompt,
        expandPrompt,
        ...(negativePrompt.trim()
          ? { negativePrompt: negativePrompt.trim() }
          : {}),
        ...(sourceMedia
          ? {
              sourceMediaId: sourceMedia.id,
              denoisingStrength,
              ...(maskPngBase64 ? { maskPngBase64 } : {}),
            }
          : {}),
      });
      setPrompt("");
      setNegativePrompt("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to generate image.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryGeneration = async (generation: ImageGenerationEntry) => {
    if (!hasAccess) {
      setError(
        "you do not have access to image generation - please request it",
      );
      return;
    }

    const sameSourceMask =
      generation.hasMask &&
      Boolean(generation.sourceMediaId) &&
      Boolean(maskPngBase64) &&
      (sourceMedia?.id === generation.sourceMediaId ||
        sourceMediaId === generation.sourceMediaId)
        ? maskPngBase64
        : undefined;

    setError(null);
    setBusyGenerationId(generation.id);
    setBusyAction("retry");
    try {
      await queueGeneration(
        imageGenerationRetryInput({
          prompt: generation.prompt,
          negativePrompt: generation.negativePrompt,
          expandPrompt: generation.expandPrompt,
          sourceMediaId: generation.sourceMediaId,
          denoisingStrength: generation.denoisingStrength,
          hasMask: generation.hasMask,
          maskPngBase64: sameSourceMask,
        }),
      );
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Unable to retry image generation.",
      );
    } finally {
      setBusyGenerationId(null);
      setBusyAction(null);
    }
  };

  const removeGeneration = async (
    generation: ImageGenerationEntry,
    action: "keep" | "discard",
  ) => {
    setError(null);
    setBusyGenerationId(generation.id);
    setBusyAction(action);
    try {
      const response = await fetch(
        `/api/image-generations/${encodeURIComponent(generation.id)}?action=${action}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          payload.error ?? "Unable to update generation history.",
        );
      }

      setGenerations((current) =>
        current.filter((item) => item.id !== generation.id),
      );
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to update generation history.",
      );
    } finally {
      setBusyGenerationId(null);
      setBusyAction(null);
    }
  };

  const clearHistory = async () => {
    setError(null);
    setIsClearing(true);
    try {
      const response = await fetch("/api/image-generations", {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to clear generation history.");
      }

      setGenerations((current) =>
        current.filter((generation) => isActiveStatus(generation.status)),
      );
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Unable to clear generation history.",
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-[color-mix(in_srgb,var(--theme-panel)_92%,transparent)] px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              {isImg2Img ? "image to image" : "text to image"}
            </p>
            <h1 className="truncate text-lg font-semibold sm:text-xl">
              generate image
            </h1>
            <p className="text-xs text-neutral-500">
              Images usually finish in about 30 seconds.
            </p>
          </div>
          <Link
            href="/gallery"
            className="rounded border border-neutral-200 px-3 py-1.5 text-xs"
          >
            back to gallery
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start sm:px-8">
        <section
          className={clsx(
            "space-y-4 rounded-xl border border-neutral-200 p-4 sm:p-5",
            !hasAccess ? "bg-neutral-100" : "bg-[var(--theme-panel)]",
          )}
        >
          {!hasAccess ? (
            <p className="rounded border border-neutral-300 bg-neutral-200 px-3 py-2 text-xs text-neutral-600">
              you do not have access to image generation - please request it
            </p>
          ) : null}

          {sourceError ? (
            <p
              role="alert"
              className="text-xs text-red-600"
            >
              {sourceError}
            </p>
          ) : null}

          {sourceMedia ? (
            <div className="flex gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourceThumbnailUrl(sourceMedia)}
                  alt={
                    sourceMedia.originalFileName ??
                    `${sourceMedia.baseName}.${sourceMedia.ext}`
                  }
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {sourceMedia.originalFileName ??
                    `${sourceMedia.baseName}.${sourceMedia.ext}`}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {sourceMedia.width && sourceMedia.height
                    ? `${sourceMedia.width}×${sourceMedia.height}`
                    : "source image"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!hasAccess}
                    onClick={() => setIsMaskEditorOpen(true)}
                    className="rounded border border-neutral-200 px-2 py-1 text-[11px] disabled:opacity-50"
                  >
                    {maskPngBase64 ? "edit mask" : "draw mask"}
                  </button>
                  {maskPngBase64 ? (
                    <button
                      type="button"
                      onClick={() => setMaskPngBase64(null)}
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                    >
                      clear mask
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearSource}
                    className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                  >
                    remove source
                  </button>
                </div>
                {maskPngBase64 ? (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Mask ready. Only painted areas will be edited.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Optional: draw a mask to limit edits to part of the image.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <label className="block text-xs font-medium">
            prompt
            <textarea
              value={prompt}
              maxLength={2000}
              rows={isImg2Img ? 4 : 5}
              disabled={!hasAccess || isSubmitting}
              onChange={(event) => setPrompt(event.target.value)}
              className="mt-1 w-full resize-y rounded border border-neutral-300 bg-[var(--theme-input-bg)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
              placeholder={
                isImg2Img
                  ? "golden hour lighting, keep the same subject"
                  : "cinematic photograph of a futuristic city"
              }
            />
          </label>
          <label className="block text-xs font-medium">
            negative prompt (optional)
            <textarea
              value={negativePrompt}
              maxLength={2000}
              rows={3}
              disabled={!hasAccess || isSubmitting}
              onChange={(event) => setNegativePrompt(event.target.value)}
              className="mt-1 w-full resize-y rounded border border-neutral-300 bg-[var(--theme-input-bg)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
              placeholder="blurry, distorted, artifacts"
            />
          </label>

          {isImg2Img ? (
            <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">how much to change</p>
                  <p className="text-[11px] text-neutral-500">
                    {denoisingStrength.toFixed(2)} · {denoisingStrengthLabel(denoisingStrength)}
                  </p>
                </div>
              </div>
              <input
                type="range"
                min={minDenoisingStrength}
                max={maxDenoisingStrength}
                step={0.05}
                value={denoisingStrength}
                disabled={!hasAccess || isSubmitting}
                onChange={(event) =>
                  setDenoisingStrength(Number(event.target.value))
                }
                className="w-full"
              />
              <div className="grid grid-cols-3 gap-2">
                {denoisingPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    disabled={!hasAccess || isSubmitting}
                    onClick={() => setDenoisingStrength(preset.value)}
                    className={clsx(
                      "rounded border px-2 py-1 text-[11px] disabled:opacity-50",
                      Math.abs(denoisingStrength - preset.value) < 0.001
                        ? "border-neutral-900 bg-black text-white"
                        : "border-neutral-200",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-neutral-500">
                0.2–0.35 keeps most of the original. 0.4–0.6 restyles it.
                0.7+ mostly replaces it.
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={expandPrompt}
              disabled={!hasAccess || isSubmitting}
              onChange={(event) => setExpandPrompt(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              expand prompt with AI
              <span className="mt-0.5 block font-normal text-neutral-500">
                Adds typical image-prompt keywords (lighting, composition,
                quality) before generation.
              </span>
            </span>
          </label>

          {error ? (
            <p
              role="alert"
              className="text-xs text-red-600"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={
                !hasAccess ||
                isSubmitting ||
                busyAction === "retry" ||
                !prompt.trim()
              }
              onClick={() => void submitGeneration()}
              className="rounded bg-black px-4 py-2 text-xs text-white disabled:opacity-50"
            >
              {isSubmitting ? "queueing..." : isImg2Img ? "restyle" : "generate"}
            </button>
          </div>
        </section>

        <section
          aria-labelledby="generation-requests-title"
          className="min-w-0 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="generation-requests-title"
              className="text-sm font-semibold"
            >
              generation requests
            </h2>
            <button
              type="button"
              disabled={
                isClearing ||
                !generations.some(
                  (generation) => !isActiveStatus(generation.status),
                )
              }
              onClick={() => void clearHistory()}
              className="rounded border border-neutral-200 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isClearing ? "clearing..." : "clear list"}
            </button>
          </div>
          {generations.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No image generations yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {generations.map((generation) => (
                <article
                  key={generation.id}
                  className="flex w-full min-h-28 gap-3 rounded-xl border border-neutral-200 p-3 sm:gap-4 sm:p-4"
                >
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                    {generation.thumbnailUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            url:
                              generation.imageUrl ??
                              generation.thumbnailUrl ??
                              "",
                            alt: `Generated image for: ${generation.prompt}`,
                          })
                        }
                        className="h-full w-full cursor-zoom-in"
                        aria-label="Open generated image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={generation.thumbnailUrl}
                          alt={`Generated image for: ${generation.prompt}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <LightFileImage
                          className={clsx(
                            "h-6 w-6",
                            generation.status === "failed"
                              ? "text-red-400"
                              : "text-neutral-400",
                          )}
                          fill="currentColor"
                        />
                      </div>
                    )}
                    {generation.sourceThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={generation.sourceThumbnailUrl}
                        alt=""
                        className="absolute bottom-1 left-1 h-8 w-8 rounded border border-white object-cover shadow"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={clsx(
                          "text-xs font-medium",
                          generation.status === "failed"
                            ? "text-red-600"
                            : "text-neutral-700",
                        )}
                      >
                        {formatStatus(generation.status)}
                        {generation.sourceMediaId ? " · img2img" : ""}
                        {generation.hasMask ? " · mask" : ""}
                      </span>
                      <time
                        dateTime={generation.createdAt}
                        className="text-[10px] text-neutral-400"
                      >
                        {new Date(generation.createdAt).toLocaleTimeString()}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs text-neutral-600">
                      {generation.prompt}
                    </p>
                    {generation.error ? (
                      <p className="mt-2 line-clamp-2 text-[11px] text-red-600">
                        {generation.error}
                      </p>
                    ) : null}
                    {!isActiveStatus(generation.status) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {generation.status === "failed" ? (
                          <button
                            type="button"
                            disabled={
                              busyGenerationId === generation.id || isSubmitting
                            }
                            onClick={() => void retryGeneration(generation)}
                            className="rounded bg-black px-3 py-1 text-[11px] text-white disabled:opacity-50"
                          >
                            {busyGenerationId === generation.id &&
                            busyAction === "retry"
                              ? "retrying..."
                              : "retry"}
                          </button>
                        ) : null}
                        {generation.status === "complete" &&
                        generation.mediaId ? (
                          <button
                            type="button"
                            disabled={busyGenerationId === generation.id}
                            onClick={() =>
                              void removeGeneration(generation, "keep")
                            }
                            className="rounded bg-black px-3 py-1 text-[11px] text-white disabled:opacity-50"
                          >
                            {busyGenerationId === generation.id &&
                            busyAction === "keep"
                              ? "working..."
                              : "keep"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busyGenerationId === generation.id}
                          onClick={() =>
                            void removeGeneration(generation, "discard")
                          }
                          className="rounded border border-red-200 px-3 py-1 text-[11px] text-red-600 disabled:opacity-50"
                        >
                          {busyGenerationId === generation.id &&
                          busyAction === "discard"
                            ? "working..."
                            : "discard"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {isMaskEditorOpen && sourceMedia ? (
        <ImageGenerationMaskEditor
          imageUrl={sourceImageUrl(sourceMedia)}
          imageAlt={
            sourceMedia.originalFileName ??
            `${sourceMedia.baseName}.${sourceMedia.ext}`
          }
          onCancel={() => setIsMaskEditorOpen(false)}
          onApply={(nextMask) => {
            setMaskPngBase64(nextMask);
            setIsMaskEditorOpen(false);
          }}
        />
      ) : null}

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Generated image preview"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 sm:p-8"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded border border-white/40 bg-black/40 px-3 py-1.5 text-xs text-white"
          >
            close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full cursor-default object-contain"
          />
        </div>
      ) : null}
    </main>
  );
};
