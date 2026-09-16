import Link from "next/link"
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react"
import clsx from "clsx"

type TermButtonVariant =
  | "default"
  | "primary"
  | "danger"
  | "cyan"
  | "admin"
  | "muted"
  | "muted-gen"

type TermButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: TermButtonVariant
  active?: boolean
  href?: string
  children: ReactNode
}

const VARIANT_CLASS: Record<TermButtonVariant, string | undefined> = {
  default: undefined,
  primary: "primary",
  danger: "danger",
  cyan: "cyan",
  admin: "admin",
  muted: "muted",
  "muted-gen": "muted-gen"
}

export const TermButton = ({
  variant = "default",
  active = false,
  href,
  className,
  children,
  type = "button",
  onClick,
  ...props
}: TermButtonProps) => {
  const classes = clsx("term-btn", VARIANT_CLASS[variant], active && "active", className)

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        draggable={false}
        onClick={onClick as unknown as MouseEventHandler<HTMLAnchorElement>}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      className={classes}
      data-active={active ? "true" : undefined}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}
