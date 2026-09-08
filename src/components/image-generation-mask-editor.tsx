"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import clsx from "clsx";

const brushPresets = [
  { id: "fine", label: "fine", size: 10 },
  { id: "medium", label: "medium", size: 28 },
  { id: "broad", label: "broad", size: 64 },
  { id: "fill", label: "fill", size: 140 },
] as const;

const overlayColors = [
  { id: "red", label: "red", value: "#ef4444" },
  { id: "black", label: "black", value: "#000000" },
  { id: "white", label: "white", value: "#ffffff" },
  { id: "green", label: "green", value: "#22c55e" },
] as const;

type OverlayColorId = (typeof overlayColors)[number]["id"];
type DisplayMode = "overlay" | "mask" | "onion";
type BrushTool = "paint" | "erase";

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to export mask."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });

const blobToBase64 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export const ImageGenerationMaskEditor = ({
  imageUrl,
  imageAlt,
  onApply,
  onCancel,
}: {
  imageUrl: string;
  imageAlt: string;
  onApply: (maskPngBase64: string | null) => void;
  onCancel: () => void;
}) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoHistoryRef = useRef<ImageData[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoFnRef = useRef<() => void>(() => {});
  const redoFnRef = useRef<() => void>(() => {});
  const [tool, setTool] = useState<BrushTool>("paint");
  const [brushSize, setBrushSize] = useState(28);
  const [hardness, setHardness] = useState(80);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [overlayColor, setOverlayColor] = useState<OverlayColorId>("red");
  const [overlayOpacity, setOverlayOpacity] = useState(55);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("overlay");
  const [cursor, setCursor] = useState<{
    left: number;
    top: number;
    size: number;
  } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redrawOverlay = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas) {
      return;
    }
    const overlay = overlayCanvas.getContext("2d");
    if (!overlay) {
      return;
    }

    overlay.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (displayMode === "mask") {
      overlay.fillStyle = "#000000";
      overlay.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlay.drawImage(maskCanvas, 0, 0);
      return;
    }

    overlay.globalAlpha = overlayOpacity / 100;
    overlay.drawImage(maskCanvas, 0, 0);
    overlay.globalCompositeOperation = "source-in";
    overlay.fillStyle =
      overlayColors.find((color) => color.id === overlayColor)?.value ?? "#ef4444";
    overlay.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlay.globalCompositeOperation = "source-over";
    overlay.globalAlpha = 1;
  }, [displayMode, overlayColor, overlayOpacity]);

  const snapshot = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");
    if (!maskCanvas || !context) {
      return;
    }
    historyRef.current = [
      ...historyRef.current.slice(-29),
      context.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
    ];
    redoHistoryRef.current = [];
  }, []);

  const sizeCanvases = useCallback(() => {
    const image = imageRef.current;
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!image || !maskCanvas || !overlayCanvas) {
      return;
    }

    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    [maskCanvas, overlayCanvas].forEach((canvas) => {
      canvas.width = width;
      canvas.height = height;
    });
    const context = maskCanvas.getContext("2d");
    context?.clearRect(0, 0, width, height);
    historyRef.current = [];
    redoHistoryRef.current = [];
    setIsReady(true);
    redrawOverlay();
  }, [redrawOverlay]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoFnRef.current();
        } else {
          undoFnRef.current();
        }
      }
      if (event.key.toLowerCase() === "b") {
        setTool("paint");
      }
      if (event.key.toLowerCase() === "e") {
        setTool("erase");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      return null;
    }
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const paintAt = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");
    if (!maskCanvas || !context) {
      return;
    }

    const radius = brushSize / 2;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const hardStop = Math.min(0.98, hardness / 100);
    const alpha = brushOpacity / 100;
    if (tool === "erase") {
      context.globalCompositeOperation = "destination-out";
      gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      gradient.addColorStop(hardStop, `rgba(0, 0, 0, ${alpha})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else {
      context.globalCompositeOperation = "source-over";
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(hardStop, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    }
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "source-over";
    redrawOverlay();
  };

  const strokeTo = (point: { x: number; y: number }) => {
    const previous = lastPointRef.current;
    if (!previous) {
      paintAt(point.x, point.y);
      lastPointRef.current = point;
      return;
    }
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(2, brushSize / 6)));
    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      paintAt(
        previous.x + (point.x - previous.x) * t,
        previous.y + (point.y - previous.y) * t,
      );
    }
    lastPointRef.current = point;
  };

  const undo = () => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");
    const previous = historyRef.current.at(-1);
    if (!maskCanvas || !context || !previous) {
      return;
    }
    redoHistoryRef.current = [
      ...redoHistoryRef.current,
      context.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
    ];
    historyRef.current = historyRef.current.slice(0, -1);
    context.putImageData(previous, 0, 0);
    redrawOverlay();
  };

  const redo = () => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");
    const next = redoHistoryRef.current.at(-1);
    if (!maskCanvas || !context || !next) {
      return;
    }
    historyRef.current = [
      ...historyRef.current,
      context.getImageData(0, 0, maskCanvas.width, maskCanvas.height),
    ];
    redoHistoryRef.current = redoHistoryRef.current.slice(0, -1);
    context.putImageData(next, 0, 0);
    redrawOverlay();
  };

  useEffect(() => {
    undoFnRef.current = undo;
    redoFnRef.current = redo;
  });

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");
    if (!maskCanvas || !context) {
      return;
    }
    snapshot();
    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    redrawOverlay();
  };

  const invertMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");
    if (!maskCanvas || !context) {
      return;
    }
    snapshot();
    const current = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    const inverse = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    for (let index = 0; index < current.data.length; index += 4) {
      inverse.data[index + 3] = 255 - current.data[index + 3];
    }
    context.putImageData(inverse, 0, 0);
    redrawOverlay();
  };

  const applyMask = async () => {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");
    if (!maskCanvas || !context) {
      return;
    }

    const pixels = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const hasPaint = pixels.data.some((value, index) => index % 4 === 3 && value > 8);
    if (!hasPaint) {
      onApply(null);
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = maskCanvas.width;
    exportCanvas.height = maskCanvas.height;
    const exportContext = exportCanvas.getContext("2d");
    if (!exportContext) {
      setError("Unable to export mask.");
      return;
    }
    exportContext.fillStyle = "#000000";
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportContext.drawImage(maskCanvas, 0, 0);
    try {
      onApply(await blobToBase64(await toBlob(exportCanvas)));
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "Unable to export mask.",
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mask-editor-title"
      className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-4 py-3 sm:px-6">
        <div>
          <h2
            id="mask-editor-title"
            className="text-sm font-semibold sm:text-base"
          >
            draw mask
          </h2>
          <p className="text-[11px] text-white/65">
            Painted areas can change. Everything else stays as it is.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-white/30 px-3 py-1.5 text-xs"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={() => void applyMask()}
            className="rounded bg-white px-3 py-1.5 text-xs text-black"
          >
            use mask
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1 bg-neutral-950">
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
            <div className="relative max-h-full max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={imageUrl}
                alt={imageAlt}
                onLoad={sizeCanvases}
                className={clsx(
                  "max-h-[min(78vh,900px)] max-w-full select-none object-contain",
                  displayMode === "mask" ? "opacity-0" : null,
                  displayMode === "onion" ? "opacity-40" : null,
                )}
                draggable={false}
              />
              <canvas
                ref={maskCanvasRef}
                className="hidden"
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 h-full w-full touch-none cursor-none"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  snapshot();
                  const point = canvasPoint(event);
                  if (!point) {
                    return;
                  }
                  lastPointRef.current = point;
                  paintAt(point.x, point.y);
                }}
                onPointerMove={(event) => {
                  const point = canvasPoint(event);
                  if (!point) {
                    return;
                  }
                  const canvas = event.currentTarget;
                  const bounds = canvas.getBoundingClientRect();
                  setCursor({
                    left: event.clientX - bounds.left,
                    top: event.clientY - bounds.top,
                    size: (brushSize / canvas.width) * bounds.width,
                  });
                  if (event.buttons === 0) {
                    return;
                  }
                  strokeTo(point);
                }}
                onPointerUp={() => {
                  lastPointRef.current = null;
                }}
                onPointerLeave={() => {
                  setCursor(null);
                  lastPointRef.current = null;
                }}
              />
              {cursor ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full border border-white/80"
                  style={{
                    width: cursor.size,
                    height: cursor.size,
                    left: cursor.left,
                    top: cursor.top,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ) : null}
            </div>
          </div>
          {!isReady ? (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
              Loading image...
            </p>
          ) : null}
        </div>

        <aside className="max-h-[42vh] space-y-4 overflow-y-auto border-t border-white/15 px-4 py-4 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 lg:px-5">
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-medium uppercase tracking-wide text-white/55">
              brush
            </legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTool("paint")}
                className={clsx(
                  "flex-1 rounded border px-2 py-1.5 text-xs",
                  tool === "paint"
                    ? "border-white bg-white text-black"
                    : "border-white/25",
                )}
              >
                paint
              </button>
              <button
                type="button"
                onClick={() => setTool("erase")}
                className={clsx(
                  "flex-1 rounded border px-2 py-1.5 text-xs",
                  tool === "erase"
                    ? "border-white bg-white text-black"
                    : "border-white/25",
                )}
              >
                erase
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {brushPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setBrushSize(preset.size)}
                  className={clsx(
                    "rounded border px-1 py-1 text-[10px]",
                    brushSize === preset.size
                      ? "border-white bg-white/15"
                      : "border-white/20",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="block text-[11px] text-white/75">
              size {brushSize}px
              <input
                type="range"
                min={4}
                max={220}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-[11px] text-white/75">
              hardness {hardness}%
              <input
                type="range"
                min={0}
                max={100}
                value={hardness}
                onChange={(event) => setHardness(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-[11px] text-white/75">
              opacity {brushOpacity}%
              <input
                type="range"
                min={10}
                max={100}
                value={brushOpacity}
                onChange={(event) => setBrushOpacity(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-medium uppercase tracking-wide text-white/55">
              mask display
            </legend>
            <div className="grid grid-cols-3 gap-1">
              {(["overlay", "mask", "onion"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDisplayMode(mode)}
                  className={clsx(
                    "rounded border px-1 py-1 text-[10px]",
                    displayMode === mode
                      ? "border-white bg-white/15"
                      : "border-white/20",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {overlayColors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setOverlayColor(color.id)}
                  className={clsx(
                    "rounded border px-1 py-1 text-[10px]",
                    overlayColor === color.id
                      ? "border-white bg-white/15"
                      : "border-white/20",
                  )}
                >
                  {color.label}
                </button>
              ))}
            </div>
            <label className="block text-[11px] text-white/75">
              overlay {overlayOpacity}%
              <input
                type="range"
                min={15}
                max={100}
                value={overlayOpacity}
                onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={undo}
              className="rounded border border-white/25 px-2 py-1 text-[11px]"
            >
              undo
            </button>
            <button
              type="button"
              onClick={redo}
              className="rounded border border-white/25 px-2 py-1 text-[11px]"
            >
              redo
            </button>
            <button
              type="button"
              onClick={invertMask}
              className="rounded border border-white/25 px-2 py-1 text-[11px]"
            >
              invert
            </button>
            <button
              type="button"
              onClick={clearMask}
              className="rounded border border-white/25 px-2 py-1 text-[11px]"
            >
              clear
            </button>
          </div>
          {error ? (
            <p
              role="alert"
              className="text-[11px] text-red-300"
            >
              {error}
            </p>
          ) : null}
          <p className="text-[11px] leading-5 text-white/50">
            B paints, E erases, Esc cancels. White in the exported mask is the
            area the model may edit.
          </p>
        </aside>
      </div>
    </div>
  );
};
