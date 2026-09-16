import Link from "next/link"
import type { ReactNode } from "react"
import clsx from "clsx"

type TextLinkVariant = "muted" | "default" | "loud"

const VARIANT_STYLES: Record<TextLinkVariant, string> = {
  muted: "text-neutral-500",
  default: "text-[var(--theme-link)]",
  loud: "text-[var(--theme-accent)]"
}

export default function TextLink({
  href,
  children,
  className,
  variant = "muted"
}: {
  href: string
  children: ReactNode
  className?: string
  variant?: TextLinkVariant
}) {
  return (
    <Link
      href={href}
      className={clsx("underline", VARIANT_STYLES[variant], className)}
    >
      {children}
    </Link>
  )
}
