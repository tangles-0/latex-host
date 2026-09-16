import type { ReactNode } from "react"
import clsx from "clsx"

type PageScaffoldWidth = "default" | "narrow" | "wide" | "flush"

export const PageScaffold = ({
  children,
  width = "default",
  className,
  as: Tag = "main"
}: {
  children: ReactNode
  width?: PageScaffoldWidth
  className?: string
  as?: "main" | "div" | "section"
}) => {
  return (
    <Tag
      className={clsx(
        "page-scaffold",
        width === "narrow" && "page-scaffold-narrow",
        width === "wide" && "page-scaffold-wide",
        width === "flush" && "page-scaffold-flush",
        className
      )}
    >
      {children}
    </Tag>
  )
}
