"use client"

import { useEffect, useState } from "react"
import { pickGalleryLoadingMessage } from "@/lib/gallery-loading-messages"

const MESSAGE_INTERVAL_MS = 2400

export default function GalleryLoadingModal() {
  const [message, setMessage] = useState("warming up the spinny rust...")
  const [messageKey, setMessageKey] = useState(0)

  useEffect(() => {
    const rotateMessage = () => {
      setMessage(current => pickGalleryLoadingMessage(current))
      setMessageKey(current => current + 1)
    }

    const initialTimer = window.setTimeout(rotateMessage, 0)
    const timer = window.setInterval(rotateMessage, MESSAGE_INTERVAL_MS)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div
      className="gallery-loading-overlay fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="gallery-loading-title"
      aria-describedby="gallery-loading-message"
    >
      <div
        className="gallery-loading-backdrop absolute inset-0"
        aria-hidden="true"
      />

      <div className="gallery-loading-card relative w-full max-w-md overflow-hidden rounded-md border border-neutral-200 bg-white p-6 shadow-lg">
        <div
          className="gallery-loading-scanline pointer-events-none absolute inset-0"
          aria-hidden="true"
        />

        <div className="relative flex flex-col items-center gap-5 text-center">
          <div
            className="gallery-loading-orbits relative h-28 w-28"
            aria-hidden="true"
          >
            <span className="gallery-loading-ring gallery-loading-ring-a" />
            <span className="gallery-loading-ring gallery-loading-ring-b" />
            <span className="gallery-loading-ring gallery-loading-ring-c" />
            <span className="gallery-loading-core" />
            <span className="gallery-loading-spark-orbit gallery-loading-spark-orbit-a">
              <span className="gallery-loading-spark" />
            </span>
            <span className="gallery-loading-spark-orbit gallery-loading-spark-orbit-b">
              <span className="gallery-loading-spark gallery-loading-spark-sm" />
            </span>
            <span className="gallery-loading-spark-orbit gallery-loading-spark-orbit-c">
              <span className="gallery-loading-spark gallery-loading-spark-xs" />
            </span>
          </div>

          <div className="space-y-1">
            <p
              id="gallery-loading-title"
              className="text-lg font-semibold tracking-tight"
            >
              loading ur gallery
            </p>
            <p
              key={messageKey}
              id="gallery-loading-message"
              className="gallery-loading-message min-h-[2.5rem] text-sm text-neutral-600"
              aria-live="polite"
            >
              {message}
            </p>
          </div>

          <div
            className="gallery-loading-track h-1.5 w-full overflow-hidden rounded-full"
            aria-hidden="true"
          >
            <div className="gallery-loading-bar h-full w-1/3 rounded-full" />
          </div>

          <p className="text-[11px] tracking-wide text-neutral-500 uppercase">
            pls hold — spinny rust is thinking
          </p>
        </div>
      </div>
    </div>
  )
}
