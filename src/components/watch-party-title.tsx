import { useEffect, useState } from "react"

import { WATCH_PARTY_TITLE_MAX } from "@/lib/watch-party-types"

export const WatchPartyTitle = ({
  title,
  isHost,
  onSave
}: {
  title: string
  isHost: boolean
  onSave: (title: string) => Promise<void>
}) => {
  const [draft, setDraft] = useState(title)
  const [isFocused, setIsFocused] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setDraft(title)
    }
  }, [isFocused, title])

  if (!isHost) {
    return <h1 className="text-lg font-medium">{title}</h1>
  }

  const saveDraft = async () => {
    const nextTitle = draft.replace(/\s+/g, " ").trim()
    if (!nextTitle || nextTitle === title) {
      setDraft(title)
      return
    }
    setIsSaving(true)
    try {
      await onSave(nextTitle)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <label
        className="sr-only"
        htmlFor="watch-party-title"
      >
        Watch party title
      </label>
      <input
        id="watch-party-title"
        value={draft}
        maxLength={WATCH_PARTY_TITLE_MAX}
        disabled={isSaving}
        onChange={event => setDraft(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false)
          void saveDraft()
        }}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.currentTarget.blur()
          }
        }}
        className="w-full max-w-xl border-b border-neutral-300 bg-transparent text-lg font-medium outline-none"
      />
    </div>
  )
}
