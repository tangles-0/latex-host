"use client";

import { useState } from "react";
import clsx from "clsx";

export function WaveformThumbnail({
  smUrl,
  lgUrl,
  alt = "Audio waveform",
  className,
}: {
  smUrl: string;
  lgUrl: string;
  alt?: string;
  className?: string;
}) {
  const [shouldLoadLg, setShouldLoadLg] = useState(false);
  const [lgLoaded, setLgLoaded] = useState(false);

  return (
    <div
      className={clsx("relative overflow-hidden bg-neutral-950", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={smUrl}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
        loading="lazy"
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onLoad={() => setShouldLoadLg(true)}
      />
      {shouldLoadLg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lgUrl}
          alt=""
          className={clsx(
            "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
            lgLoaded ? "opacity-100" : "opacity-0",
          )}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onLoad={() => setLgLoaded(true)}
        />
      ) : null}
    </div>
  );
}
