import type { ReactNode } from "react"
import clsx from "clsx"

export const EmptyState = ({
  title,
  children,
  action,
  className
}: {
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) => {
  return (
    <div className={clsx("empty-state", className)}>
      {title ? <div className="font-display text-xl text-[var(--theme-accent)]">{title}</div> : null}
      {children ? <div className="mt-2 text-sm">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
