"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import clsx from "clsx";
import { LightFileImage } from "@energiz3r/icon-library/Icons/Light/LightFileImage";

import type { ImageGenerationEntry } from "@/lib/image-generations/types";

const pollIntervalMs = 2_000;

const isActiveStatus = (status: ImageGenerationEntry["status"]) =>
  status === "pending" || status === "generating" || status === "uploading";

const formatStatus = (status: ImageGenerationEntry["status"]) => {
  if (status === "pending") {
    return "queued";
  }

  return status;
};

export const ImageGenerationDialog = ({
  hasAccess,
  className,
}: {
  hasAccess: boolean;
  className?: string;
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [expandPrompt, setExpandPrompt] = useState(false);
  const [generations, setGenerations] = useState<ImageGenerationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [busyGenerationId, setBusyGenerationId] = useState<string | null>(null);
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

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setLightbox(null);
    router.refresh();
  }, [router]);

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
    if (!hasActiveGenerations) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadGenerations();
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [hasActiveGenerations, loadGenerations]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lightbox) {
          setLightbox(null);
        } else {
          closeDialog();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, isOpen, lightbox]);

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
      const response = await fetch("/api/image-generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: normalizedPrompt,
          expandPrompt,
          ...(negativePrompt.trim()
            ? { negativePrompt: negativePrompt.trim() }
            : {}),
        }),
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

  const removeGeneration = async (
    generation: ImageGenerationEntry,
    action: "keep" | "discard",
  ) => {
    setError(null);
    setBusyGenerationId(generation.id);
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
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
          void loadGenerations();
        }}
        className={className}
      >
        <LightFileImage className="h-6.5 w-3.5 sm:h-3.5" fill="currentColor" />
        generate
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-generation-title"
          className="fixed inset-0 z-50 flex min-h-screen flex-col overflow-y-auto bg-white"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-8">
            <div>
              <h2
                id="image-generation-title"
                className="text-lg font-semibold text-neutral-900"
              >
                generate image
              </h2>
              <p className="text-xs text-neutral-500">
                Images usually finish in about 30 seconds.
              </p>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              className="rounded border border-neutral-200 px-3 py-1 text-xs"
            >
              close
            </button>
          </header>

          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8">
            <div
              className={clsx(
                "space-y-4 rounded border border-neutral-200 p-4",
                !hasAccess ? "bg-neutral-100" : "bg-white",
              )}
            >
              {!hasAccess ? (
                <p className="rounded border border-neutral-300 bg-neutral-200 px-3 py-2 text-xs text-neutral-600">
                  you do not have access to image generation - please request it
                </p>
              ) : null}
              <label className="block text-xs font-medium text-neutral-700">
                prompt
                <textarea
                  value={prompt}
                  maxLength={2000}
                  rows={5}
                  disabled={!hasAccess || isSubmitting}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="mt-1 w-full resize-y rounded border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                  placeholder="cinematic photograph of a futuristic city"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                negative prompt (optional)
                <textarea
                  value={negativePrompt}
                  maxLength={2000}
                  rows={3}
                  disabled={!hasAccess || isSubmitting}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  className="mt-1 w-full resize-y rounded border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                  placeholder="blurry, distorted, artifacts"
                />
              </label>
              <label className="flex items-start gap-2 text-xs font-medium text-neutral-700">
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
                <p role="alert" className="text-xs text-red-600">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={closeDialog}
                  className="rounded border border-neutral-200 px-4 py-2 text-xs disabled:opacity-50"
                >
                  cancel
                </button>
                <button
                  type="button"
                  disabled={!hasAccess || isSubmitting || !prompt.trim()}
                  onClick={() => void submitGeneration()}
                  className="rounded bg-black px-4 py-2 text-xs text-white disabled:opacity-50"
                >
                  {isSubmitting ? "queueing..." : "generate"}
                </button>
              </div>
            </div>

            <section
              aria-labelledby="generation-requests-title"
              className="space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h3
                  id="generation-requests-title"
                  className="text-sm font-semibold"
                >
                  generation requests
                </h3>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {generations.map((generation) => (
                    <article
                      key={generation.id}
                      className="flex min-h-28 gap-3 rounded border border-neutral-200 p-3"
                    >
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100">
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
                          <LightFileImage
                            className={clsx(
                              "h-6 w-6",
                              generation.status === "failed"
                                ? "text-red-400"
                                : "text-neutral-400",
                            )}
                            fill="currentColor"
                          />
                        )}
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
                          </span>
                          <time
                            dateTime={generation.createdAt}
                            className="text-[10px] text-neutral-400"
                          >
                            {new Date(
                              generation.createdAt,
                            ).toLocaleTimeString()}
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
                          <div className="mt-3 flex gap-2">
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
                                keep
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
                              {busyGenerationId === generation.id
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
        </div>
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
    </>
  );
};
