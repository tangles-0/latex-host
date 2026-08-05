"use client";

import type { ReactNode } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmModal = ({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl"
      >
        <h2
          id="confirm-modal-title"
          className="text-base font-semibold"
        >
          {title}
        </h2>
        <div className="mt-3 text-sm text-neutral-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-neutral-200 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded px-3 py-1.5 text-xs text-white disabled:opacity-50 ${
              confirmTone === "danger" ? "bg-red-700" : "bg-black"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
