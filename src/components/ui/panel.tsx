import type { ReactNode } from "react"
import clsx from "clsx"

export default function Panel({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx("border border-neutral-200 bg-[var(--theme-card)] p-4", className)}>
      {children}
    </div>
  )
}
