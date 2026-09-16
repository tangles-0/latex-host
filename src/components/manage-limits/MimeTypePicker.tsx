"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  Check,
  Code2,
  FileCog,
  FileText,
  Image as ImageIcon,
  Package,
  Plus,
  Search,
  ShieldAlert,
  Video,
  X
} from "lucide-react"
import clsx from "clsx"

import { StatusBadge } from "@/components/ui/status-badge"
import { TermButton } from "@/components/ui/term-button"
import { TermInput } from "@/components/ui/term-input"

import { KNOWN_TYPES, MIME_CATEGORIES, MIME_PRESETS, normalizeTypes, type MimeCategoryId } from "./limit-options"

type MimeTypePickerProps = {
  value: string[]
  onChange: (next: string[]) => void
}

function categoryIcon(categoryId: MimeCategoryId) {
  const className = "h-4 w-4"
  switch (categoryId) {
    case "image":
      return <ImageIcon className={className} />
    case "video":
      return <Video className={className} />
    case "document":
      return <FileText className={className} />
    case "code":
      return <Code2 className={className} />
    case "config":
      return <FileCog className={className} />
    case "software":
      return <Package className={className} />
    case "file":
      return <Archive className={className} />
  }
}

export const MimeTypePicker = ({ value, onChange }: MimeTypePickerProps) => {
  const [query, setQuery] = useState("")
  const [activeCategoryId, setActiveCategoryId] = useState<MimeCategoryId>("code")
  const [isShowingSelected, setIsShowingSelected] = useState(false)
  const [customType, setCustomType] = useState("")

  const normalizedValue = useMemo(() => normalizeTypes(value), [value])
  const selected = useMemo(() => new Set(normalizedValue), [normalizedValue])
  const normalizedQuery = query.trim().toLowerCase()
  const activeCategory = MIME_CATEGORIES.find(category => category.id === activeCategoryId) ?? MIME_CATEGORIES[0]
  const custom = normalizedValue.filter(type => !KNOWN_TYPES.has(type))

  const visibleEntries = useMemo(() => {
    const categories = normalizedQuery ? MIME_CATEGORIES : [activeCategory]
    return categories
      .flatMap(category => category.types.map(type => ({ type, category })))
      .filter(entry => {
        const matchesSearch =
          !normalizedQuery ||
          entry.type.toLowerCase().includes(normalizedQuery) ||
          entry.category.label.toLowerCase().includes(normalizedQuery)
        return matchesSearch && (!isShowingSelected || selected.has(entry.type))
      })
  }, [activeCategory, isShowingSelected, normalizedQuery, selected])

  function setTypes(types: string[]) {
    onChange(normalizeTypes(types))
  }

  function toggleType(type: string) {
    const next = new Set(selected)
    if (next.has(type)) {
      next.delete(type)
    } else {
      next.add(type)
    }
    setTypes(Array.from(next))
  }

  function addTypes(types: string[]) {
    setTypes([...normalizedValue, ...types])
  }

  function removeTypes(types: string[]) {
    const removed = new Set(types)
    setTypes(normalizedValue.filter(type => !removed.has(type)))
  }

  function addCustomType() {
    const next = customType.trim().toLowerCase()
    if (!next) {
      return
    }
    addTypes([next])
    setCustomType("")
  }

  const selectedInActiveCategory = activeCategory.types.filter(type => selected.has(type)).length

  return (
    <div className="overflow-hidden border border-neutral-200 bg-[var(--theme-card)]">
      <div className="border-b border-neutral-200 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Allowed file types</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
              Search by extension or MIME type, choose a preset, or browse a category. Changes are saved with this
              scope.
            </p>
          </div>
          <StatusBadge tone={normalizedValue.length === 0 ? "pend" : "ok"}>
            {normalizedValue.length === 0 ? "Unrestricted" : `${normalizedValue.length} allowed`}
          </StatusBadge>
        </div>

        {normalizedValue.length === 0 ? (
          <div className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            No allowlist is active. Every file type is currently accepted for this scope. Choose a preset or select
            individual types to restrict uploads.
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {MIME_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setTypes([...preset.types, ...custom])}
              className="group border border-neutral-200 bg-[var(--theme-card)] p-3 text-left hover:border-neutral-200 focus-visible:outline-none"
            >
              <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                {preset.label}
                <span className="text-[10px] font-medium text-neutral-500 opacity-0 transition group-hover:opacity-100">
                  Use preset
                </span>
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-neutral-500">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search MIME types and extensions</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <TermInput
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search .tsx, Python, application/json..."
              className="pl-9"
            />
          </label>
          <TermButton
            aria-pressed={isShowingSelected}
            active={isShowingSelected}
            onClick={() => setIsShowingSelected(current => !current)}
          >
            {isShowingSelected ? "Showing selected" : "Show selected only"}
          </TermButton>
        </div>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
          {MIME_CATEGORIES.map(category => {
            const categorySelected = category.types.filter(type => selected.has(type)).length
            const isActive = category.id === activeCategoryId && !normalizedQuery
            return (
              <TermButton
                key={category.id}
                active={isActive}
                onClick={() => {
                  setQuery("")
                  setActiveCategoryId(category.id)
                }}
              >
                {categoryIcon(category.id)}
                {category.label}
                <span className="border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-500">
                  {categorySelected}/{category.types.length}
                </span>
              </TermButton>
            )
          })}
        </div>

        <div className="mt-3 flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {normalizedQuery ? (
                <>
                  <Search className="h-4 w-4" />
                  Search results
                </>
              ) : (
                <>
                  {categoryIcon(activeCategory.id)}
                  {activeCategory.label}
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {normalizedQuery
                ? `${visibleEntries.length} matching types across all categories`
                : activeCategory.description}
            </p>
          </div>
          {!normalizedQuery ? (
            <div className="flex gap-2">
              <TermButton
                onClick={() => addTypes(activeCategory.types)}
                disabled={selectedInActiveCategory === activeCategory.types.length}
              >
                Select category
              </TermButton>
              <TermButton
                onClick={() => removeTypes(activeCategory.types)}
                disabled={selectedInActiveCategory === 0}
              >
                Clear category
              </TermButton>
            </div>
          ) : null}
        </div>

        {!normalizedQuery && activeCategory.id === "software" ? (
          <div className="mt-4 flex gap-2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Executables and packages can distribute untrusted code. Enable only the formats this group genuinely needs.
          </div>
        ) : null}

        {visibleEntries.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleEntries.map(({ type, category }) => {
              const isChecked = selected.has(type)
              return (
                <button
                  key={`${category.id}-${type}`}
                  type="button"
                  aria-pressed={isChecked}
                  onClick={() => toggleType(type)}
                  className={clsx(
                    "flex min-h-12 items-center gap-3 border px-3 py-2 text-left focus-visible:outline-none",
                    isChecked
                      ? "border-neutral-200 bg-[var(--theme-card)]"
                      : "border-neutral-200 hover:border-neutral-200"
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center border",
                      isChecked ? "border-neutral-200 bg-[var(--theme-card)]" : "border-neutral-200"
                    )}
                  >
                    {isChecked ? (
                      <Check
                        className="h-3.5 w-3.5"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-[11px] font-medium">{type}</span>
                    {normalizedQuery ? (
                      <span className="mt-0.5 block text-[10px] text-neutral-400">{category.label}</span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 border border-dashed border-neutral-200 px-4 py-8 text-center">
            <p className="text-sm font-medium">No file types found</p>
            <p className="mt-1 text-xs text-neutral-500">
              Try another search, turn off “selected only,” or add a custom value below.
            </p>
          </div>
        )}

        <div className="mt-5 border border-neutral-200 bg-[var(--theme-card)] p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold">Custom MIME type or extension</h4>
            <p className="text-[11px] text-neutral-500">
              Add values not listed above, such as <span className="font-mono">application/vnd.example</span> or{" "}
              <span className="font-mono">.custom</span>.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <TermInput
              type="text"
              value={customType}
              onChange={event => setCustomType(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  addCustomType()
                }
              }}
              placeholder=".ext or type/subtype"
              className="min-w-0 flex-1 font-mono"
            />
            <TermButton
              variant="primary"
              onClick={addCustomType}
              disabled={!customType.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </TermButton>
          </div>
          {custom.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {custom.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => removeTypes([type])}
                  className="inline-flex items-center gap-1.5 border border-neutral-200 bg-[var(--theme-card)] px-2.5 py-1 font-mono text-[10px] hover:border-red-200 hover:text-red-700"
                  title={`Remove ${type}`}
                >
                  {type}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {normalizedValue.length > 0 ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setTypes([])}
              className="text-[11px] font-medium text-amber-700 underline underline-offset-4"
            >
              Remove allowlist and permit every type
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
