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
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-neutral-50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Allowed file types</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
              Search by extension or MIME type, choose a preset, or browse a category. Changes are saved with this
              scope.
            </p>
          </div>
          <div
            className={clsx(
              "inline-flex shrink-0 items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-medium",
              normalizedValue.length === 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
            )}
          >
            {normalizedValue.length === 0 ? <ShieldAlert className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {normalizedValue.length === 0 ? "Unrestricted" : `${normalizedValue.length} allowed`}
          </div>
        </div>

        {normalizedValue.length === 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
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
              className="group rounded-xl border border-neutral-200 bg-white p-3 text-left transition hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none"
            >
              <span className="flex items-center justify-between gap-2 text-xs font-semibold text-neutral-900">
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
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search .tsx, Python, application/json..."
              className="h-10 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-neutral-400"
            />
          </label>
          <button
            type="button"
            aria-pressed={isShowingSelected}
            onClick={() => setIsShowingSelected(current => !current)}
            className={clsx(
              "h-10 rounded-xl border px-3 text-xs font-medium transition",
              isShowingSelected
                ? "border-neutral-800 bg-neutral-100 text-neutral-900"
                : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {isShowingSelected ? "Showing selected" : "Show selected only"}
          </button>
        </div>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
          {MIME_CATEGORIES.map(category => {
            const categorySelected = category.types.filter(type => selected.has(type)).length
            const isActive = category.id === activeCategoryId && !normalizedQuery
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setQuery("")
                  setActiveCategoryId(category.id)
                }}
                className={clsx(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition",
                  isActive
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
                )}
              >
                {categoryIcon(category.id)}
                {category.label}
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    isActive ? "bg-white text-neutral-900" : "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {categorySelected}/{category.types.length}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
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
              <button
                type="button"
                onClick={() => addTypes(activeCategory.types)}
                disabled={selectedInActiveCategory === activeCategory.types.length}
                className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Select category
              </button>
              <button
                type="button"
                onClick={() => removeTypes(activeCategory.types)}
                disabled={selectedInActiveCategory === 0}
                className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear category
              </button>
            </div>
          ) : null}
        </div>

        {!normalizedQuery && activeCategory.id === "software" ? (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
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
                    "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none",
                    isChecked
                      ? "border-neutral-800 bg-neutral-100 text-neutral-900"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      isChecked ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"
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
          <div className="mt-4 rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">No file types found</p>
            <p className="mt-1 text-xs text-neutral-500">
              Try another search, turn off “selected only,” or add a custom value below.
            </p>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold text-neutral-900">Custom MIME type or extension</h4>
            <p className="text-[11px] text-neutral-500">
              Add values not listed above, such as <span className="font-mono">application/vnd.example</span> or{" "}
              <span className="font-mono">.custom</span>.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <input
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
              className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-xs outline-none"
            />
            <button
              type="button"
              onClick={addCustomType}
              disabled={!customType.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {custom.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {custom.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => removeTypes([type])}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-mono text-[10px] text-neutral-700 transition hover:border-red-200 hover:text-red-700"
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
