import clsx from "clsx"

export const SharePill = ({
  isShared,
  shouldShowOff = false,
  absolutePosition = false,
  className
}: {
  isShared?: boolean
  shouldShowOff?: boolean
  absolutePosition?: boolean
  className?: string
}) => {
  if (!isShared && !shouldShowOff) {
    return null
  }
  return (
    <span
      className={clsx(
        isShared && absolutePosition && "share-badge",
        isShared && !absolutePosition && "status-badge status-badge-shr",
        !isShared && "status-badge",
        className
      )}
    >
      {isShared ? (absolutePosition ? "SHR" : "shared") : "not shared"}
    </span>
  )
}
