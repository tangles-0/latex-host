"use client"

import { useState, useRef, useEffect } from "react"
import clsx from "clsx"
import { useTheme } from "@/components/theme/theme-provider"
import { ThemeIcon, THEMES } from "@/components/theme/themes"

const formatThemeLabel = (option: string): string => {
  if (option === "crt") {
    return "CRT"
  }
  return option.replace("-", " ")
}

export const ThemeSelector = ({
  placement = "floating"
}: {
  placement?: "floating" | "nav" | "banner"
}) => {
  const { theme, setTheme, isSaving } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isNav = placement === "nav" || placement === "banner"

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className={clsx(
        "theme-selector",
        isNav ? "relative" : "floating-theme-selector fixed top-2 right-2 z-[120]"
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "floating-theme-button term-btn flex items-center justify-center !p-0",
          isNav ? "h-8 w-8" : "h-8 w-8 sm:h-10 sm:w-10"
        )}
        aria-label="Select theme"
        aria-expanded={isOpen}
      >
        <ThemeIcon theme={theme} />
      </button>

      {isOpen ? (
        <div className="floating-theme-dropdown modal-panel absolute right-0 z-[200] mt-2 w-48">
          <div className="py-1">
            {THEMES.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  void setTheme(option)
                  setIsOpen(false)
                }}
                disabled={isSaving}
                className={`floating-theme-option flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                  theme === option ? "font-medium" : ""
                } ${isSaving ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <ThemeIcon theme={option} />
                <span className="capitalize">{formatThemeLabel(option)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function FloatingThemeSelector() {
  return <ThemeSelector placement="floating" />
}
