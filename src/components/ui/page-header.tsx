import type { ReactNode } from "react"
import clsx from "clsx"
import TextLink from "@/components/ui/text-link"

type PageHeaderProps = {
  title: string
  subtitle?: string
  backLink?: {
    href: string
    label: string
  }
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

export default function PageHeader({
  title,
  subtitle,
  backLink,
  actions,
  children,
  className
}: PageHeaderProps) {
  return (
    <header className={clsx("section-header flex-wrap items-start", className)}>
      <div className="space-y-2">
        {backLink ? (
          <TextLink href={backLink.href} className="text-sm">
            {backLink.label}
          </TextLink>
        ) : null}
        <h1 className="section-header-title text-2xl">{title}</h1>
        {subtitle ? <p className="text-neutral-500">{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
