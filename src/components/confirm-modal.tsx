"use client"

import type { ReactNode } from "react"
import { TermButton } from "@/components/ui/term-button"

type ConfirmModalProps = {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmTone?: "default" | "danger"
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal = ({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "default",
  busy = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) => {
  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="modal-panel w-full max-w-md p-5"
      >
        <h2
          id="confirm-modal-title"
          className="font-display text-xl text-[var(--theme-accent)]"
        >
          {title}
        </h2>
        <div className="mt-3 text-sm text-neutral-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <TermButton
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </TermButton>
          <TermButton
            variant={confirmTone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </TermButton>
        </div>
      </div>
    </div>
  )
}
