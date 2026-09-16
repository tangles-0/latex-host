import type { ReactNode } from "react"
import clsx from "clsx"

export const Skeleton = ({ className }: { className?: string }) => {
  return <div className={clsx("skeleton-block", className)} />
}

export const SkeletonGrid = ({
  count = 8,
  className
}: {
  count?: number
  className?: string
}) => {
  return (
    <div className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="skeleton-tile skeleton-block"
        />
      ))}
    </div>
  )
}

export const SkeletonTable = ({
  rows = 6,
  columns = 4
}: {
  rows?: number
  columns?: number
}) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex gap-3"
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className="h-6 flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export const RouteLoading = ({
  title = "loading...",
  children
}: {
  title?: string
  children?: ReactNode
}) => {
  return (
    <div className="page-scaffold">
      <div className="section-header">
        <span className="section-header-title">{title}</span>
      </div>
      {children ?? <SkeletonGrid />}
    </div>
  )
}
