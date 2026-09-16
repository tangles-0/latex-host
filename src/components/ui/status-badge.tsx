import clsx from "clsx"

export type StatusBadgeTone =
  | "ok"
  | "err"
  | "shr"
  | "pend"
  | "upl"
  | "feat"
  | "fix"
  | "info"

const LABELS: Record<StatusBadgeTone, string> = {
  ok: "OK",
  err: "ERR",
  shr: "SHR",
  pend: "PEND",
  upl: "UPL",
  feat: "FEAT",
  fix: "FIX",
  info: "INFO"
}

export const StatusBadge = ({
  tone,
  children,
  className
}: {
  tone: StatusBadgeTone
  children?: string
  className?: string
}) => {
  return (
    <span className={clsx("status-badge", `status-badge-${tone}`, className)}>
      {children ?? LABELS[tone]}
    </span>
  )
}
