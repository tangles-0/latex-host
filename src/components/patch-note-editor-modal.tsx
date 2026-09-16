"use client"

import { useState } from "react"
import PatchNoteMarkdown from "@/components/patch-note-markdown"
import { TermButton } from "@/components/ui/term-button"
import { TermTextarea } from "@/components/ui/term-input"

type PatchNoteEditorModalProps = {
  open: boolean
  initialValue: string
  isSaving: boolean
  error?: string | null
  title: string
  submitLabel: string
  onClose: () => void
  onSubmit: (content: string) => Promise<void>
}

const PatchNoteEditorBody = ({
  initialValue,
  isSaving,
  error,
  title,
  submitLabel,
  onClose,
  onSubmit
}: Omit<PatchNoteEditorModalProps, "open">) => {
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [content, setContent] = useState(initialValue)

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="modal-panel w-full max-w-3xl p-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <TermButton onClick={onClose}>Close</TermButton>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <TermButton
            active={tab === "write"}
            onClick={() => setTab("write")}
          >
            write
          </TermButton>
          <TermButton
            active={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            preview
          </TermButton>
        </div>

        <div className="mt-4">
          {tab === "write" ? (
            <TermTextarea
              value={content}
              onChange={event => setContent(event.target.value)}
              rows={14}
              placeholder="Write patch notes in markdown..."
            />
          ) : (
            <div className="min-h-[280px] border border-neutral-200 p-3">
              <PatchNoteMarkdown content={content || "_Nothing to preview yet._"} />
            </div>
          )}
        </div>

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <TermButton onClick={onClose}>Cancel</TermButton>
          <TermButton
            variant="primary"
            onClick={() => void onSubmit(content)}
            disabled={isSaving}
          >
            {submitLabel}
          </TermButton>
        </div>
      </div>
    </div>
  )
}

export default function PatchNoteEditorModal({
  open,
  initialValue,
  ...props
}: PatchNoteEditorModalProps) {
  if (!open) {
    return null
  }

  return (
    <PatchNoteEditorBody
      key={initialValue}
      initialValue={initialValue}
      {...props}
    />
  )
}
