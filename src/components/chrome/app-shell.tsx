"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AppNav, shouldShowAppNav } from "@/components/chrome/app-nav"
import FloatingThemeSelector from "@/components/theme/floating-theme-selector"
import { stashPendingUploads } from "@/lib/pending-uploads"

type AppShellProps = {
  isAuthenticated: boolean
  username: string
  isAdmin: boolean
  isNodeMode: boolean
  children: ReactNode
}

function isFileDrag(event: { dataTransfer?: DataTransfer | null }): boolean {
  const types = event.dataTransfer?.types
  return Boolean(types && Array.from(types).includes("Files"))
}

export const AppShell = ({
  isAuthenticated,
  username,
  isAdmin,
  isNodeMode,
  children
}: AppShellProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [dragActive, setDragActive] = useState(false)
  const dragCount = useRef(0)
  const authed = isAuthenticated || status === "authenticated"
  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    username
  const showNav = shouldShowAppNav(pathname, authed)
  const showFloatingTheme = !showNav && !(pathname === "/" && !isNodeMode)
  const canDrop = authed && pathname !== "/upload"

  const clearDropOverlay = useCallback(() => {
    dragCount.current = 0
    setDragActive(false)
  }, [])

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canDrop || !isFileDrag(event)) {
        return
      }
      event.preventDefault()
      dragCount.current += 1
      setDragActive(true)
    },
    [canDrop]
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canDrop || !isFileDrag(event)) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    },
    [canDrop]
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canDrop || !isFileDrag(event)) {
        return
      }
      dragCount.current -= 1
      if (dragCount.current <= 0) {
        clearDropOverlay()
      }
    },
    [canDrop, clearDropOverlay]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canDrop) {
        return
      }
      event.preventDefault()
      clearDropOverlay()
      if (!isFileDrag(event)) {
        return
      }
      const files = Array.from(event.dataTransfer.files)
      if (files.length === 0) {
        return
      }
      stashPendingUploads(files)
      router.push("/upload")
    },
    [canDrop, clearDropOverlay, router]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearDropOverlay()
      }
    }
    const onDragEnd = () => {
      clearDropOverlay()
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("dragend", onDragEnd)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("dragend", onDragEnd)
    }
  }, [clearDropOverlay])

  useEffect(() => {
    if (!dragActive) {
      return
    }
    const onClick = () => {
      clearDropOverlay()
    }
    window.addEventListener("click", onClick)
    return () => window.removeEventListener("click", onClick)
  }, [clearDropOverlay, dragActive])

  return (
    <div
      className="min-h-screen"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showNav ? (
        <AppNav
          username={displayName}
          isAdmin={isAdmin}
          isNodeMode={isNodeMode}
        />
      ) : showFloatingTheme ? (
        <FloatingThemeSelector />
      ) : null}
      {children}
      {dragActive ? (
        <div className="drag-upload-overlay">
          <div className="text-center">
            <div className="font-display glow-accent text-5xl leading-none">DROP TO UPLOAD</div>
            <div className="mt-2 text-xs text-neutral-500">release files to queue for upload</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
