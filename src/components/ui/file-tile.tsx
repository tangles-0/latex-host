import type { HTMLAttributes, ReactNode } from "react"
import clsx from "clsx"

type FileTileProps = HTMLAttributes<HTMLDivElement> & {
  selected?: boolean
  children: ReactNode
}

export const FileTile = ({ selected = false, className, children, ...props }: FileTileProps) => {
  return (
    <div
      className={clsx("file-tile", selected && "selected", className)}
      {...props}
    >
      {children}
    </div>
  )
}
