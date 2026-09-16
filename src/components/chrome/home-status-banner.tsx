"use client"

import { useEffect, useState } from "react"
import { ThemeSelector } from "@/components/theme/floating-theme-selector"

const formatCount = (value: number): string => {
  return value.toLocaleString("en-US")
}

const formatUtc = (date: Date): string => {
  return date.toISOString().replace("T", " ").slice(0, 19)
}

type HomeStatusBannerProps = {
  userCount: number | null
  fileCount: number | null
  initialUtc: string
}

export const HomeStatusBanner = ({
  userCount,
  fileCount,
  initialUtc
}: HomeStatusBannerProps) => {
  const [utc, setUtc] = useState(initialUtc)

  useEffect(() => {
    const tick = () => {
      setUtc(formatUtc(new Date()))
    }
    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="home-status-banner relative z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-neutral-200 bg-[var(--theme-bg)] px-5 py-1.5 text-[10px] text-neutral-500">
      <span className="text-[var(--theme-text-soft)]">latex_fileserv_v2.0</span>
      <span aria-hidden="true">│</span>
      <span>
        status: <span className="text-[var(--theme-accent)]">ONLINE</span>
      </span>
      {userCount != null ? (
        <>
          <span aria-hidden="true">│</span>
          <span>
            users: <span className="text-[var(--theme-text)]">{formatCount(userCount)}</span>
          </span>
        </>
      ) : null}
      {fileCount != null ? (
        <>
          <span aria-hidden="true">│</span>
          <span>
            files: <span className="text-[var(--theme-text)]">{formatCount(fileCount)}</span>
          </span>
        </>
      ) : null}
      <div className="flex-1" />
      <span suppressHydrationWarning>
        {utc} UTC
      </span>
      <span
        className="cursor-blink text-[var(--theme-accent)]"
        aria-hidden="true"
      >
        █
      </span>
      <ThemeSelector placement="banner" />
    </div>
  )
}

export default HomeStatusBanner
