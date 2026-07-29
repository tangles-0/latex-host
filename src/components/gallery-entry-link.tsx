"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import GalleryLoadingModal from "@/components/gallery-loading-modal"

type GalleryEntryLinkProps = {
  href?: string
  children: ReactNode
  className?: string
}

export default function GalleryEntryLink({
  href = "/gallery",
  children,
  className
}: GalleryEntryLinkProps) {
  const [isNavigating, setIsNavigating] = useState(false)

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={() => {
          setIsNavigating(true)
        }}
      >
        {children}
      </Link>
      {isNavigating ? <GalleryLoadingModal /> : null}
    </>
  )
}
