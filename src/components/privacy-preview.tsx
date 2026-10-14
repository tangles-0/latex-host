import clsx from "clsx";
import { LightFileAlt } from "@energiz3r/icon-library/Icons/Light/LightFileAlt";
import { renderFileIconForExtension } from "@/lib/FileIconHelper";
import {
  privacyVisualFor,
  type PrivacyVisual,
} from "@/lib/gallery-privacy";

const SHAPE_COLORS = [
  "#e11d48",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
];

const TEXT_CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=~^<>{}[]|/\\?!§¶†‡•★☆∆∑µπΩ";

type PrivacyShape = {
  left: string;
  top: string;
  width: string;
  height: string;
  radius: string;
  color: string;
  rotate: number;
};

function createRng(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildShapes(seed: string): { base: string; shapes: PrivacyShape[] } {
  const rng = createRng(`shapes:${seed}`);
  const count = 6 + Math.floor(rng() * 3);
  const shapes = Array.from({ length: count }, () => ({
    left: `${Math.floor(rng() * 80) - 15}%`,
    top: `${Math.floor(rng() * 80) - 15}%`,
    width: `${32 + Math.floor(rng() * 46)}%`,
    height: `${28 + Math.floor(rng() * 48)}%`,
    radius: `${30 + Math.floor(rng() * 70)}%`,
    color: SHAPE_COLORS[Math.floor(rng() * SHAPE_COLORS.length)] ?? "#3b82f6",
    rotate: Math.floor(rng() * 360),
  }));
  return {
    base: SHAPE_COLORS[Math.floor(rng() * SHAPE_COLORS.length)] ?? "#8b5cf6",
    shapes,
  };
}

function buildBlurredText(seed: string): string[] {
  const rng = createRng(`text:${seed}`);
  const lineCount = 7 + Math.floor(rng() * 3);
  return Array.from({ length: lineCount }, () => {
    const wordCount = 3 + Math.floor(rng() * 4);
    const words = Array.from({ length: wordCount }, () => {
      const length = 2 + Math.floor(rng() * 8);
      let word = "";
      for (let index = 0; index < length; index += 1) {
        word += TEXT_CHARSET[Math.floor(rng() * TEXT_CHARSET.length)] ?? "a";
      }
      return word;
    });
    return words.join(" ");
  });
}

export function BlurredThumbnail({ seed }: { seed: string }) {
  const { base, shapes } = buildShapes(seed);
  return (
    <div className="privacy-blur-layer privacy-blur-shapes" aria-hidden="true">
      <span className="privacy-blur-base" style={{ background: base }} />
      {shapes.map((shape, index) => (
        <span
          key={index}
          className="privacy-blur-shape"
          style={{
            left: shape.left,
            top: shape.top,
            width: shape.width,
            height: shape.height,
            borderRadius: shape.radius,
            background: shape.color,
            transform: `rotate(${shape.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function BlurredText({ seed }: { seed: string }) {
  const lines = buildBlurredText(seed);
  return (
    <div className="privacy-blur-layer privacy-blur-text" aria-hidden="true">
      {lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
}

type PrivacyFilePreviewProps = {
  seed: string;
  kind: string;
  ext?: string;
  mimeType?: string;
  compact?: boolean;
  className?: string;
  iconClassName?: string;
};

export function PrivacyFilePreview({
  seed,
  kind,
  ext,
  mimeType,
  compact = false,
  className,
  iconClassName,
}: PrivacyFilePreviewProps) {
  const visual: PrivacyVisual = privacyVisualFor({ kind, ext, mimeType });
  const frameClass =
    className ??
    (compact ? "h-20 w-20 rounded" : "mt-2 h-48 max-h-64 w-full");
  const iconClass = clsx(
    visual === "icon" ? "text-neutral-500" : "privacy-preview-icon",
    iconClassName ?? (compact ? "h-6 w-6" : "h-10 w-10"),
  );

  return (
    <div
      className={clsx(
        "privacy-preview",
        visual === "shapes" && "privacy-preview-shapes",
        visual === "icon" && "privacy-preview-plain",
        frameClass,
      )}
    >
      {visual === "shapes" ? <BlurredThumbnail seed={seed} /> : null}
      {visual === "text" ? <BlurredText seed={seed} /> : null}
      {kind === "note" ? (
        <LightFileAlt className={iconClass} fill="currentColor" />
      ) : (
        renderFileIconForExtension(ext, {
          className: iconClass,
          fill: "currentColor",
        })
      )}
    </div>
  );
}
