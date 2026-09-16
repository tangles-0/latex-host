"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import { TermButton } from "@/components/ui/term-button"
import { ThemeSelector } from "@/components/theme/floating-theme-selector"

type AppNavProps = {
  username: string
  isAdmin: boolean
  isNodeMode: boolean
}

const AVATAR_COLORS = [
  "var(--theme-accent)",
  "var(--theme-accent-2)",
  "var(--theme-accent-danger)"
]

const avatarColorFor = (username: string): string => {
  const index = username.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0]
}

export const CREATE_NOTE_SEARCH_PARAM = "mk-note"

const NavLabel = ({ children }: { children: string }) => {
  return <span className="app-nav-label">{children}</span>
}

export const AppNav = ({ username, isAdmin, isNodeMode }: AppNavProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accountOpen, setAccountOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const galleryTab = searchParams.get("tab")
  const isGallery = pathname === "/gallery" && galleryTab !== "albums"
  const isAlbums = pathname === "/gallery" && galleryTab === "albums"

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <nav className="app-nav">
      <Link
        href="/"
        className="app-nav-wordmark glitch-text"
        draggable={false}
      >
        latex.gg
      </Link>

      <div className="app-nav-links">
        <TermButton
          href="/gallery"
          active={isGallery}
          title="gallery"
        >
          ▤ <NavLabel>gallery</NavLabel>
        </TermButton>
        <TermButton
          href="/gallery?tab=albums"
          active={isAlbums}
          title="albums"
        >
          ◫ <NavLabel>albums</NavLabel>
        </TermButton>
        <TermButton
          href="/upload"
          active={pathname === "/upload"}
          title="upload"
        >
          ▲ <NavLabel>upload</NavLabel>
        </TermButton>

        <div className="app-nav-divider" />

        {isNodeMode ? (
          <TermButton
            href="/import"
            active={pathname === "/import"}
            variant="muted"
            title="import"
          >
            ⬇ <NavLabel>import</NavLabel>
          </TermButton>
        ) : (
          <TermButton
            href="/generate"
            active={pathname.startsWith("/generate")}
            variant="muted-gen"
            title="generate image"
          >
            ✦ <NavLabel>gen img</NavLabel>
          </TermButton>
        )}
        <TermButton
          variant="muted"
          title="make new text note"
          onClick={() => {
            router.push(`/gallery?${CREATE_NOTE_SEARCH_PARAM}=1`)
          }}
        >
          ✎ <NavLabel>mk note</NavLabel>
        </TermButton>
        {isNodeMode ? null : (
          <TermButton
            href="/messages"
            active={pathname.startsWith("/messages")}
            variant="muted"
            title="messages"
          >
            ◉ <NavLabel>msg</NavLabel>
          </TermButton>
        )}
        {isAdmin && !isNodeMode ? (
          <TermButton
            href="/admin"
            variant="admin"
            active={pathname.startsWith("/admin")}
            title="admin"
          >
            ⚡ <NavLabel>admin</NavLabel>
          </TermButton>
        ) : null}
      </div>

      <div className="app-nav-end">
        <ThemeSelector placement="nav" />

        <div
          className="relative"
          ref={dropdownRef}
        >
          <button
            type="button"
            onClick={() => setAccountOpen(open => !open)}
            className="flex h-8 w-8 items-center justify-center text-sm font-bold"
            style={{
              borderRadius: "50%",
              background: avatarColorFor(username),
              border: `2px solid ${avatarColorFor(username)}`,
              color: "var(--theme-bg)",
              boxShadow: `0 0 8px color-mix(in srgb, ${avatarColorFor(username)} 40%, transparent)`
            }}
            aria-label="account menu"
            aria-expanded={accountOpen}
          >
            {username.slice(0, 1).toUpperCase()}
          </button>
          {accountOpen ? (
            <div className="modal-panel absolute right-0 top-10 z-[200] min-w-[160px]">
              <div className="border-b border-[var(--theme-border)] px-3 py-2 text-sm text-[var(--theme-text-muted)]">
                <span className="text-[var(--theme-accent)]">{username}</span>
                {isAdmin ? (
                  <span className="ml-1 text-[var(--theme-text-soft)]">[admin]</span>
                ) : null}
              </div>
              <TermButton
                href="/account"
                className="w-full justify-start border-0 px-3 py-2"
                onClick={() => setAccountOpen(false)}
              >
                ⚙ account settings
              </TermButton>
              <TermButton
                href="/signout"
                variant="danger"
                className="w-full justify-start border-0 px-3 py-2"
                onClick={() => setAccountOpen(false)}
              >
                ⏻ sign out
              </TermButton>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  )
}

export const shouldShowAppNav = (pathname: string, isAuthenticated: boolean): boolean => {
  if (!isAuthenticated) {
    return false
  }
  if (pathname.startsWith("/watch/")) {
    return false
  }
  if (pathname.startsWith("/share/")) {
    return false
  }
  return true
}

export const AppNavSpacer = ({ className }: { className?: string }) => {
  return <div className={clsx("h-[var(--theme-nav-height)]", className)} />
}
