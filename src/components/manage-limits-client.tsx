"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Copy,
  Gauge,
  HardDrive,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Settings2,
  Users,
  X
} from "lucide-react"
import clsx from "clsx"

import { MimeTypePicker } from "@/components/manage-limits/MimeTypePicker"
import {
  areEditableLimitsEqual,
  copyEditableLimits,
  type GroupLimitRow,
  type GroupLimits
} from "@/components/manage-limits/limit-options"
import { StatusBadge } from "@/components/ui/status-badge"
import { TermButton } from "@/components/ui/term-button"
import { TermInput } from "@/components/ui/term-input"
import { TermSelect } from "@/components/ui/term-select"

type ScopeId = string
type SizeField = "maxImageSize" | "maxVideoSize" | "maxDocumentSize" | "maxOtherSize"
type Unit = "MB" | "GB"

type ToastState = {
  tone: "success" | "error"
  message: string
} | null

type ScopeSummary = {
  id: ScopeId
  name: string
  description: string
  limits: GroupLimits
}

const MB = 1024 * 1024
const GB = 1024 * 1024 * 1024

const SIZE_FIELDS: Array<{ key: SizeField; label: string; description: string }> = [
  { key: "maxImageSize", label: "Images", description: "Photos and graphics" },
  { key: "maxVideoSize", label: "Video", description: "Video uploads" },
  { key: "maxDocumentSize", label: "Documents", description: "Docs, code, and text" },
  { key: "maxOtherSize", label: "Other files", description: "Archives and binaries" }
]

function cloneLimits(limits: GroupLimits): GroupLimits {
  return { ...limits, allowedTypes: [...limits.allowedTypes] }
}

function cloneRows(rows: GroupLimitRow[]): GroupLimitRow[] {
  return rows.map(row => ({ ...row, limits: cloneLimits(row.limits) }))
}

function initialUnit(bytes: number): Unit {
  return bytes >= GB ? "GB" : "MB"
}

function initialUnitsFor(limits: GroupLimits): Record<SizeField, Unit> {
  return {
    maxImageSize: initialUnit(limits.maxImageSize),
    maxVideoSize: initialUnit(limits.maxVideoSize),
    maxDocumentSize: initialUnit(limits.maxDocumentSize),
    maxOtherSize: initialUnit(limits.maxOtherSize)
  }
}

function multiplierFor(unit: Unit): number {
  return unit === "GB" ? GB : MB
}

function limitPayload(limits: GroupLimits) {
  return {
    ...limits,
    maxFileSize: Math.max(limits.maxImageSize, limits.maxVideoSize, limits.maxDocumentSize, limits.maxOtherSize)
  }
}

function scopeLabel(scopeId: ScopeId, rows: GroupLimitRow[]): string {
  if (scopeId === "default") {
    return "Ungrouped users"
  }
  return rows.find(row => row.groupId === scopeId)?.groupName ?? "Group"
}

export default function ManageLimitsClient({
  ungroupedLimits,
  groupLimits
}: {
  ungroupedLimits: GroupLimits
  groupLimits: GroupLimitRow[]
}) {
  const [defaultDraft, setDefaultDraft] = useState(() => cloneLimits(ungroupedLimits))
  const [rowDrafts, setRowDrafts] = useState(() => cloneRows(groupLimits))
  const [savedDefault, setSavedDefault] = useState(() => cloneLimits(ungroupedLimits))
  const [savedRows, setSavedRows] = useState(() => cloneRows(groupLimits))
  const [activeScopeId, setActiveScopeId] = useState<ScopeId>("default")
  const [copySourceId, setCopySourceId] = useState<ScopeId>("")
  const [isSyncOpen, setIsSyncOpen] = useState(false)
  const [syncTargetIds, setSyncTargetIds] = useState<Set<ScopeId>>(new Set())
  const [busyAction, setBusyAction] = useState<"save" | "sync" | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [unitsByScope, setUnitsByScope] = useState<Record<ScopeId, Record<SizeField, Unit>>>(() => ({
    default: initialUnitsFor(ungroupedLimits),
    ...Object.fromEntries(groupLimits.map(row => [row.groupId, initialUnitsFor(row.limits)]))
  }))

  useEffect(() => {
    if (!toast) {
      return
    }
    const timeoutId = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const scopes = useMemo<ScopeSummary[]>(
    () => [
      {
        id: "default",
        name: "Ungrouped users",
        description: "Default policy",
        limits: defaultDraft
      },
      ...rowDrafts.map(row => ({
        id: row.groupId,
        name: row.groupName,
        description: `${row.userCount} ${row.userCount === 1 ? "user" : "users"}`,
        limits: row.limits
      }))
    ],
    [defaultDraft, rowDrafts]
  )

  const activeScope = scopes.find(scope => scope.id === activeScopeId) ?? scopes[0]
  const activeLimits = activeScope.limits
  const activeSavedLimits =
    activeScopeId === "default"
      ? savedDefault
      : (savedRows.find(row => row.groupId === activeScopeId)?.limits ?? activeLimits)
  const isActiveDirty = !areEditableLimitsEqual(activeLimits, activeSavedLimits)
  const activeUnits = unitsByScope[activeScopeId] ?? initialUnitsFor(activeLimits)
  const availableSources = scopes.filter(scope => scope.id !== activeScopeId)
  const effectiveCopySourceId = availableSources.some(scope => scope.id === copySourceId)
    ? copySourceId
    : (availableSources[0]?.id ?? "")
  const availableTargets = scopes.filter(scope => scope.id !== activeScopeId)
  const selectedTargets = availableTargets.filter(scope => syncTargetIds.has(scope.id))
  const dirtyScopeCount = scopes.filter(scope => isScopeDirty(scope.id)).length

  function draftForScope(scopeId: ScopeId): GroupLimits {
    if (scopeId === "default") {
      return defaultDraft
    }
    return rowDrafts.find(row => row.groupId === scopeId)?.limits ?? defaultDraft
  }

  function savedForScope(scopeId: ScopeId): GroupLimits {
    if (scopeId === "default") {
      return savedDefault
    }
    return savedRows.find(row => row.groupId === scopeId)?.limits ?? draftForScope(scopeId)
  }

  function isScopeDirty(scopeId: ScopeId): boolean {
    return !areEditableLimitsEqual(draftForScope(scopeId), savedForScope(scopeId))
  }

  function replaceDraft(scopeId: ScopeId, limits: GroupLimits) {
    const cloned = cloneLimits(limits)
    if (scopeId === "default") {
      setDefaultDraft(cloned)
      return
    }
    setRowDrafts(current => current.map(row => (row.groupId === scopeId ? { ...row, limits: cloned } : row)))
  }

  function updateActiveDraft(updater: (current: GroupLimits) => GroupLimits) {
    if (activeScopeId === "default") {
      setDefaultDraft(current => updater(current))
      return
    }
    setRowDrafts(current =>
      current.map(row => (row.groupId === activeScopeId ? { ...row, limits: updater(row.limits) } : row))
    )
  }

  function applySavedResult(scopeId: ScopeId, limits: GroupLimits) {
    const cloned = cloneLimits(limits)
    if (scopeId === "default") {
      setDefaultDraft(cloned)
      setSavedDefault(cloned)
      return
    }
    setRowDrafts(current => current.map(row => (row.groupId === scopeId ? { ...row, limits: cloned } : row)))
    setSavedRows(current => current.map(row => (row.groupId === scopeId ? { ...row, limits: cloned } : row)))
  }

  function updateSize(field: SizeField, displayValue: string) {
    const numeric = Number(displayValue)
    const unit = activeUnits[field]
    updateActiveDraft(current => ({
      ...current,
      [field]: Math.round(numeric * multiplierFor(unit))
    }))
  }

  function updateUnit(field: SizeField, unit: Unit) {
    setUnitsByScope(current => ({
      ...current,
      [activeScopeId]: {
        ...(current[activeScopeId] ?? initialUnitsFor(activeLimits)),
        [field]: unit
      }
    }))
  }

  function copyFromScope() {
    if (!effectiveCopySourceId) {
      return
    }
    const source = draftForScope(effectiveCopySourceId)
    replaceDraft(activeScopeId, copyEditableLimits(source, activeLimits))
    setToast({
      tone: "success",
      message: `Copied settings from ${scopeLabel(effectiveCopySourceId, rowDrafts)}. Review and save when ready.`
    })
  }

  function resetActiveDraft() {
    replaceDraft(activeScopeId, savedForScope(activeScopeId))
    setToast({ tone: "success", message: `Discarded unsaved changes for ${activeScope.name}.` })
  }

  function toggleSyncTarget(scopeId: ScopeId) {
    setSyncTargetIds(current => {
      const next = new Set(current)
      if (next.has(scopeId)) {
        next.delete(scopeId)
      } else {
        next.add(scopeId)
      }
      return next
    })
  }

  async function postLimits(scopeId: ScopeId, limits: GroupLimits): Promise<GroupLimits> {
    const response = await fetch("/api/admin/limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: scopeId === "default" ? null : scopeId,
        limits: limitPayload(limits)
      })
    })

    if (!response.ok) {
      let message = "Unable to update limits."
      try {
        const payload = (await response.json()) as { error?: string }
        message = payload.error ?? message
      } catch {
        // Keep the generic message when the response body is not JSON.
      }
      throw new Error(message)
    }

    const result = (await response.json()) as { limits: GroupLimits }
    return result.limits
  }

  async function saveActiveScope() {
    setBusyAction("save")
    setToast(null)
    try {
      const saved = await postLimits(activeScopeId, activeLimits)
      applySavedResult(activeScopeId, saved)
      setToast({ tone: "success", message: `${activeScope.name} settings saved.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update limits."
      setToast({ tone: "error", message: `${activeScope.name} failed to save: ${message}` })
    } finally {
      setBusyAction(null)
    }
  }

  async function saveAndSync() {
    if (selectedTargets.length === 0) {
      return
    }

    setBusyAction("sync")
    setToast(null)
    const operations = [
      { scopeId: activeScopeId, limits: activeLimits },
      ...selectedTargets.map(target => ({
        scopeId: target.id,
        limits: copyEditableLimits(activeLimits, target.limits)
      }))
    ]
    const results = await Promise.allSettled(
      operations.map(operation => postLimits(operation.scopeId, operation.limits))
    )

    let savedCount = 0
    const failures: string[] = []
    results.forEach((result, index) => {
      const operation = operations[index]
      if (result.status === "fulfilled") {
        applySavedResult(operation.scopeId, result.value)
        savedCount += 1
      } else {
        failures.push(scopeLabel(operation.scopeId, rowDrafts))
      }
    })

    if (failures.length === 0) {
      setToast({
        tone: "success",
        message: `Saved and synchronized ${savedCount} ${savedCount === 1 ? "scope" : "scopes"}.`
      })
      setSyncTargetIds(new Set())
      setIsSyncOpen(false)
    } else {
      setToast({
        tone: "error",
        message: `Saved ${savedCount} scopes. Failed: ${failures.join(", ")}.`
      })
    }
    setBusyAction(null)
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      {toast ? (
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
          className={clsx(
            "fixed bottom-4 left-4 right-4 z-50 flex max-w-md items-start gap-3 border bg-[var(--theme-card)] px-4 py-3 text-sm sm:left-auto",
            toast.tone === "success"
              ? "border-emerald-200 text-emerald-700"
              : "border-red-200 text-red-700"
          )}
        >
          {toast.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded p-0.5 opacity-60 transition hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <aside className="min-w-0 lg:sticky lg:top-6">
        <div className="border border-neutral-200 bg-[var(--theme-card)] p-4">
          <div className="flex items-center justify-between px-2 pb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Policy scopes</h2>
              <p className="mt-1 text-[11px] text-neutral-400">{scopes.length} configurable scopes</p>
            </div>
            {dirtyScopeCount > 0 ? (
              <StatusBadge tone="pend">{`${dirtyScopeCount} unsaved`}</StatusBadge>
            ) : null}
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:block lg:space-y-1 lg:overflow-visible">
            {scopes.map(scope => {
              const isActive = scope.id === activeScopeId
              const isDirty = isScopeDirty(scope.id)
              return (
                <button
                  key={scope.id}
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => {
                    setActiveScopeId(scope.id)
                    setIsSyncOpen(false)
                  }}
                  className={clsx(
                    "flex min-w-52 shrink-0 items-center gap-3 border px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60 lg:w-full lg:min-w-0",
                    isActive
                      ? "border-neutral-200 bg-[var(--theme-card)]"
                      : "border-transparent hover:border-neutral-200"
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-200",
                      isActive ? "bg-[var(--theme-card)]" : "text-neutral-500"
                    )}
                  >
                    {scope.id === "default" ? <Users className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold">{scope.name}</span>
                      {isDirty ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: "var(--theme-alert-warning)" }}
                          title="Unsaved changes"
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-neutral-500">{scope.description}</span>
                  </span>
                  <span className="border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-500">
                    {scope.limits.allowedTypes.length === 0 ? "All" : scope.limits.allowedTypes.length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-5">
        <section className="overflow-hidden border border-neutral-200 bg-[var(--theme-card)]">
          <div className="border-b border-neutral-200 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-neutral-500">
                  {activeScope.id === "default" ? "Default policy" : "Group policy"}
                  {isActiveDirty ? (
                    <StatusBadge tone="pend">Unsaved changes</StatusBadge>
                  ) : (
                    <StatusBadge tone="ok">Saved</StatusBadge>
                  )}
                </div>
                <h2 className="mt-2 text-xl font-semibold">{activeScope.name}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
                  {activeScope.id === "default"
                    ? "Applies to users who are not assigned to a group."
                    : "Overrides the ungrouped policy for every user assigned to this group."}
                </p>
              </div>
              <TermButton
                variant="primary"
                onClick={() => void saveActiveScope()}
                disabled={busyAction !== null || !isActiveDirty}
                aria-busy={busyAction === "save"}
              >
                {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {busyAction === "save" ? "Saving..." : "Save changes"}
              </TermButton>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
            <div className="border border-neutral-200 bg-[var(--theme-card)] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-neutral-200 text-neutral-500">
                  <Copy className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-semibold">Copy settings into this editor</h3>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    Start from another scope, then review before saving.
                  </p>
                  {availableSources.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <TermSelect
                        value={effectiveCopySourceId}
                        onChange={event => setCopySourceId(event.target.value)}
                        className="min-w-0 flex-1"
                      >
                        {availableSources.map(scope => (
                          <option
                            key={scope.id}
                            value={scope.id}
                          >
                            {scope.name}
                            {isScopeDirty(scope.id) ? " (unsaved draft)" : ""}
                          </option>
                        ))}
                      </TermSelect>
                      <TermButton
                        onClick={copyFromScope}
                        disabled={busyAction !== null}
                      >
                        Copy into editor
                      </TermButton>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-neutral-500">
                      Create another group to copy settings between scopes.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-neutral-200 bg-[var(--theme-card)] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-neutral-200 text-neutral-500">
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-semibold">Synchronize scopes</h3>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    Save these settings here and apply the same policy to selected groups.
                  </p>
                  <TermButton
                    variant="primary"
                    className="mt-3"
                    onClick={() => setIsSyncOpen(current => !current)}
                    disabled={availableTargets.length === 0 || busyAction !== null}
                  >
                    {isSyncOpen ? "Close sync options" : "Choose sync targets"}
                  </TermButton>
                </div>
              </div>
            </div>
          </div>

          {isSyncOpen ? (
            <div className="border-t border-neutral-200 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Apply {activeScope.name} settings to</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    This saves the current scope and replaces every selected target’s complete limits policy.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSyncTargetIds(new Set(availableTargets.map(scope => scope.id)))}
                    className="text-[11px] font-medium text-neutral-700 hover:text-neutral-900"
                  >
                    Select all
                  </button>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={() => setSyncTargetIds(new Set())}
                    className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {availableTargets.map(scope => {
                  const isSelected = syncTargetIds.has(scope.id)
                  return (
                    <button
                      key={scope.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      onClick={() => toggleSyncTarget(scope.id)}
                      className={clsx(
                        "flex items-center gap-3 border px-3 py-3 text-left",
                        isSelected
                          ? "border-neutral-200 bg-[var(--theme-card)]"
                          : "border-neutral-200 hover:border-neutral-200"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-5 w-5 shrink-0 items-center justify-center border",
                          isSelected ? "border-neutral-200 bg-[var(--theme-card)]" : "border-neutral-200"
                        )}
                      >
                        {isSelected ? (
                          <Check
                            className="h-3.5 w-3.5"
                            strokeWidth={3}
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{scope.name}</span>
                        <span className="mt-0.5 block text-[10px] text-neutral-500">{scope.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-col gap-3 border border-neutral-200 bg-[var(--theme-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-neutral-500">
                  {selectedTargets.length === 0
                    ? "Select at least one target scope."
                    : `${selectedTargets.length} target ${selectedTargets.length === 1 ? "scope" : "scopes"} selected.`}
                </p>
                <TermButton
                  variant="primary"
                  onClick={() => void saveAndSync()}
                  disabled={selectedTargets.length === 0 || busyAction !== null}
                  aria-busy={busyAction === "sync"}
                >
                  {busyAction === "sync" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4" />
                  )}
                  {busyAction === "sync" ? "Synchronizing..." : `Save & apply to ${selectedTargets.length || 0}`}
                </TermButton>
              </div>
            </div>
          ) : null}
        </section>

        <section className="border border-neutral-200 bg-[var(--theme-card)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-200 text-neutral-500">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Image generation access</h3>
              <p className="mt-1 text-xs text-neutral-500">
                Allow users in this scope to submit image generation requests.
              </p>
              <label className="mt-4 flex cursor-pointer items-center gap-3 border border-neutral-200 p-3">
                <input
                  type="checkbox"
                  checked={activeLimits.imageGenerationEnabled}
                  disabled={busyAction !== null}
                  onChange={event =>
                    updateActiveDraft(current => ({
                      ...current,
                      imageGenerationEnabled: event.target.checked
                    }))
                  }
                  className="h-4 w-4 border-neutral-200"
                />
                <span className="text-xs font-medium">Enable image generation</span>
              </label>
            </div>
          </div>
        </section>

        <section className="border border-neutral-200 bg-[var(--theme-card)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-200 text-neutral-500">
              <HardDrive className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Upload size limits</h3>
              <p className="mt-1 text-xs text-neutral-500">Set the maximum upload size for each type of content.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SIZE_FIELDS.map(field => {
              const unit = activeUnits[field.key]
              const bytes = activeLimits[field.key]
              const displayValue = bytes > 0 ? bytes / multiplierFor(unit) : 0
              return (
                <label
                  key={field.key}
                  className="border border-neutral-200 bg-[var(--theme-card)] p-4"
                >
                  <span className="block text-xs font-semibold">{field.label}</span>
                  <span className="mt-0.5 block text-[10px] text-neutral-500">{field.description}</span>
                  <span className="mt-3 flex gap-2">
                    <TermInput
                      type="number"
                      min={0.01}
                      step="any"
                      value={Number.isFinite(displayValue) ? Number(displayValue.toFixed(2)) : 0}
                      onChange={event => updateSize(field.key, event.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <TermSelect
                      value={unit}
                      onChange={event => updateUnit(field.key, event.target.value as Unit)}
                    >
                      <option value="MB">MB</option>
                      <option value="GB">GB</option>
                    </TermSelect>
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        <section className="border border-neutral-200 bg-[var(--theme-card)] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-200 text-neutral-500">
                <Gauge className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Upload rate limit</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Maximum uploads per minute. Use 0 for no rate limit; admins are not blocked.
                </p>
              </div>
            </div>
            <label className="flex shrink-0 items-center gap-2 border border-neutral-200 p-2">
              <span className="pl-1 text-[11px] font-medium text-neutral-500">Uploads / minute</span>
              <TermInput
                type="number"
                min={0}
                value={activeLimits.rateLimitPerMinute}
                onChange={event =>
                  updateActiveDraft(current => ({
                    ...current,
                    rateLimitPerMinute: Number(event.target.value)
                  }))
                }
                className="w-24 text-right"
              />
            </label>
          </div>
        </section>

        <MimeTypePicker
          value={activeLimits.allowedTypes}
          onChange={allowedTypes => updateActiveDraft(current => ({ ...current, allowedTypes }))}
        />

        <div className="sticky bottom-3 z-20 flex flex-col gap-3 border border-neutral-200 bg-[var(--theme-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              {isActiveDirty ? "You have unsaved changes" : `${activeScope.name} is up to date`}
            </p>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              {isActiveDirty
                ? "Save this scope, or synchronize it to multiple scopes from the panel above."
                : `${activeLimits.allowedTypes.length === 0 ? "All file types" : `${activeLimits.allowedTypes.length} file types`} allowed.`}
            </p>
          </div>
          <div className="flex gap-2">
            <TermButton
              onClick={resetActiveDraft}
              disabled={!isActiveDirty || busyAction !== null}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Discard
            </TermButton>
            <TermButton
              variant="primary"
              onClick={() => void saveActiveScope()}
              disabled={!isActiveDirty || busyAction !== null}
              aria-busy={busyAction === "save"}
            >
              {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {busyAction === "save" ? "Saving..." : "Save changes"}
            </TermButton>
          </div>
        </div>
      </main>
    </div>
  )
}
