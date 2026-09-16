import type { HTMLAttributes, ReactNode } from "react"
import clsx from "clsx"

type AlbumTileProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export const AlbumTile = ({ className, children, ...props }: AlbumTileProps) => {
  return (
    <div
      className={clsx("album-tile", className)}
      {...props}
    >
      {children}
    </div>
  )
}
