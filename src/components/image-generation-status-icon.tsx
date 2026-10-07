"use client";

import { useEffect, useState } from "react";

import clsx from "clsx";
import { LightFileImage } from "@energiz3r/icon-library/Icons/Light/LightFileImage";
import { LightHourglassEnd } from "@energiz3r/icon-library/Icons/Light/LightHourglassEnd";
import { LightHourglassHalf } from "@energiz3r/icon-library/Icons/Light/LightHourglassHalf";
import { LightHourglassStart } from "@energiz3r/icon-library/Icons/Light/LightHourglassStart";
import { LightSparkles } from "@energiz3r/icon-library/Icons/Light/LightSparkles";

import type { ImageGenerationStatus } from "@/lib/image-generations/types";

const hourglassFrames = [
  LightHourglassStart,
  LightHourglassHalf,
  LightHourglassEnd,
] as const;

const useCyclingFrame = (count: number, intervalMs: number) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (count <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      setFrame((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs]);

  return frame;
};

export const ImageGenerationStatusIcon = ({
  status,
  className,
}: {
  status: ImageGenerationStatus;
  className?: string;
}) => {
  const hourglassFrame = useCyclingFrame(hourglassFrames.length, 420);
  const HourglassIcon = hourglassFrames[hourglassFrame];

  if (status === "pending") {
    return (
      <span
        className={clsx("image-gen-status-icon", className)}
        aria-hidden="true"
      >
        <HourglassIcon
          className="image-gen-hourglass h-6 w-6 text-neutral-400"
          fill="currentColor"
        />
      </span>
    );
  }

  if (status === "generating") {
    return (
      <span
        className={clsx("image-gen-status-icon image-gen-spark", className)}
        aria-hidden="true"
      >
        <span className="image-gen-spark-orbit" />
        <LightSparkles
          className="image-gen-spark-core h-6 w-6 text-neutral-300"
          fill="currentColor"
        />
      </span>
    );
  }

  return (
    <LightFileImage
      className={clsx(
        "h-6 w-6",
        status === "failed"
          ? "text-red-400"
          : status === "cancelled"
            ? "text-neutral-300"
            : "text-neutral-400",
        className,
      )}
      fill="currentColor"
    />
  );
};
