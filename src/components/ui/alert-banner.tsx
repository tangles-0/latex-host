import type { ReactNode } from "react"
import clsx from "clsx"

type AlertTone = "warning" | "info" | "success" | "danger"

const TONE_STYLES: Record<AlertTone, string> = {
  warning: "border-[var(--theme-alert-warning-border)] bg-[var(--theme-alert-warning-bg)] text-[var(--theme-alert-warning)]",
  info: "border-[var(--theme-alert-info-border)] bg-[var(--theme-alert-info-bg)] text-[var(--theme-alert-info)]",
  success: "border-[var(--theme-alert-success-border)] bg-[var(--theme-alert-success-bg)] text-[var(--theme-alert-success)]",
  danger: "border-[var(--theme-alert-danger-border)] bg-[var(--theme-alert-danger-bg)] text-[var(--theme-alert-danger)]"
}

export default function AlertBanner({
  tone = "warning",
  children
}: {
  tone?: AlertTone
  children: ReactNode
}) {
  return <div className={clsx("border p-3 text-xs", TONE_STYLES[tone])}>{children}</div>
}
