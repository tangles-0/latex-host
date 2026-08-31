import clsx from "clsx";

export const SharePill = ({
  isShared,
  shouldShowOff = false,
  absolutePosition = false,
  className,
}: {
  isShared?: boolean;
  shouldShowOff?: boolean;
  absolutePosition?: boolean;
  className?: string;
}) => {
  if (!isShared && !shouldShowOff) {
    return null;
  }
  return (
    <span
      className={clsx(
        "rounded px-2 font-medium",
        absolutePosition
          ? "absolute left-[calc(50%-40px)] top-1 z-10 py-0.5 sm:left-18"
          : className
            ? null
            : "py-1.5",
        isShared
          ? "bg-emerald-600 text-white"
          : "bg-neutral-200 text-neutral-600",
        className,
      )}
    >
      {isShared ? "shared" : "not shared"}
    </span>
  );
};
