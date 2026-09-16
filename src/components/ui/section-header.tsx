import type { ReactNode } from "react"
import clsx from "clsx"

export const SectionHeader = ({
  title,
  subtitle,
  actions,
  className
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) => {
  return (
    <div className={clsx("section-header", className)}>
      <span className="section-header-title">{title}</span>
      {subtitle ? <span className="text-xs text-neutral-500">{subtitle}</span> : null}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
