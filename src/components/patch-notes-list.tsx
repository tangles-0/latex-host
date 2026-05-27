"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import PatchNoteMarkdown, {
  normalizePatchNoteMarkdown,
} from "@/components/patch-note-markdown";

export type PatchNoteSummary = {
  id: string;
  publishedAt: string;
  updatedAt: string;
  firstLine: string;
  firstLineMarkdown: string;
};

export type PatchNoteEntry = PatchNoteSummary & {
  content: string;
};

type PatchNotesListProps = {
  notes: PatchNoteSummary[];
  editable?: boolean;
  onRequestEdit?: (note: PatchNoteEntry) => void;
  onRequestDelete?: (note: PatchNoteSummary) => void;
};

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  return date.toLocaleString();
}

function comparePatchNotes(a: PatchNoteSummary, b: PatchNoteSummary): number {
  const publishedDiff =
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  if (publishedDiff !== 0) {
    return publishedDiff;
  }
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function getOrderedPatchNotes(notes: PatchNoteSummary[]): PatchNoteSummary[] {
  return [...notes].sort(comparePatchNotes);
}

function getLatestPatchNoteId(notes: PatchNoteSummary[]): string | undefined {
  return getOrderedPatchNotes(notes)[0]?.id;
}

function getPatchNoteSummarySource(note: PatchNoteSummary): string {
  return note.firstLineMarkdown.trim() || note.firstLine.trim();
}

const summaryLineComponents: Components = {
  h1: ({ children }) => <>{children}</>,
  h2: ({ children }) => <>{children}</>,
  h3: ({ children }) => <>{children}</>,
  h4: ({ children }) => <>{children}</>,
  h5: ({ children }) => <>{children}</>,
  h6: ({ children }) => <>{children}</>,
  p: ({ children }) => <>{children}</>,
  ul: ({ children }) => <>{children}</>,
  ol: ({ children }) => <>{children}</>,
  li: ({ children }) => <>{children}</>,
  a: ({ children }) => <>{children}</>,
};

function PatchNoteSummaryLine({ summary }: { summary: string }) {
  if (!summary) {
    return null;
  }

  return (
    <span className="min-w-0 font-normal text-neutral-600">
      <ReactMarkdown components={summaryLineComponents}>
        {normalizePatchNoteMarkdown(summary)}
      </ReactMarkdown>
    </span>
  );
}

export default function PatchNotesList({
  notes,
  editable = false,
  onRequestEdit,
  onRequestDelete,
}: PatchNotesListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const latestNoteId = getLatestPatchNoteId(notes);
    return latestNoteId ? { [latestNoteId]: true } : {};
  });
  const [contentById, setContentById] = useState<Record<string, string>>({});
  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const orderedNotes = useMemo(() => getOrderedPatchNotes(notes), [notes]);
  const latestNoteId = orderedNotes[0]?.id;

  useEffect(() => {
    const validIds = new Set(notes.map((note) => note.id));
    setExpanded((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => validIds.has(id)),
      ),
    );
    setContentById((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => validIds.has(id)),
      ),
    );
    setLoadingById((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => validIds.has(id)),
      ),
    );
    setErrorById((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => validIds.has(id)),
      ),
    );
  }, [notes]);

  const fetchNote = useCallback(
    async (id: string): Promise<PatchNoteEntry | undefined> => {
      setLoadingById((current) => ({ ...current, [id]: true }));
      setErrorById((current) => ({ ...current, [id]: "" }));
      try {
        const response = await fetch(`/api/patch-notes/${id}`);
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          setErrorById((current) => ({
            ...current,
            [id]: payload.error ?? "Failed to load note.",
          }));
          return undefined;
        }
        const payload = (await response.json()) as { note: PatchNoteEntry };
        setContentById((current) => ({
          ...current,
          [id]: payload.note.content,
        }));
        return payload.note;
      } finally {
        setLoadingById((current) => ({ ...current, [id]: false }));
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !latestNoteId ||
      !expanded[latestNoteId] ||
      contentById[latestNoteId] ||
      loadingById[latestNoteId]
    ) {
      return;
    }
    void fetchNote(latestNoteId);
  }, [contentById, expanded, fetchNote, latestNoteId, loadingById]);

  async function toggleExpanded(id: string) {
    const next = !expanded[id];
    setExpanded((current) => ({ ...current, [id]: next }));
    if (next && !contentById[id]) {
      await fetchNote(id);
    }
  }

  async function handleEdit(note: PatchNoteSummary) {
    if (!onRequestEdit) {
      return;
    }
    const existingContent = contentById[note.id];
    if (existingContent) {
      onRequestEdit({ ...note, content: existingContent });
      return;
    }
    const fetched = await fetchNote(note.id);
    if (fetched) {
      onRequestEdit(fetched);
    }
  }

  return (
    <div className="space-y-3">
      {orderedNotes.length === 0 ? (
        <div className="rounded-md border border-neutral-200 p-4 text-xs text-neutral-500">
          No patch notes published yet.
        </div>
      ) : null}
      {orderedNotes.map((note) => {
        const isExpanded = Boolean(expanded[note.id]);
        const summary = getPatchNoteSummarySource(note);
        return (
          <div
            key={note.id}
            className="cursor-pointer rounded-md border border-neutral-200 p-4"
            role="button"
            tabIndex={0}
            onClick={() => void toggleExpanded(note.id)}
            aria-expanded={isExpanded}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void toggleExpanded(note.id);
              }
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-left text-sm font-medium hover:underline">
                <span className="shrink-0">
                  {formatPublishedAt(note.publishedAt)}
                  {summary ? ":" : ""}
                </span>
                <PatchNoteSummaryLine summary={summary} />
              </div>
              {editable ? (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleEdit(note);
                    }}
                    className="rounded border border-neutral-300 px-2 py-1"
                    disabled={loadingById[note.id]}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestDelete?.(note);
                    }}
                    className="rounded border border-red-200 px-2 py-1 text-red-600"
                    disabled={loadingById[note.id]}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
            {isExpanded ? (
              <div className="mt-3 border-t border-neutral-200 pt-3 text-sm">
                {loadingById[note.id] ? (
                  <p className="text-xs text-neutral-500">Loading...</p>
                ) : null}
                {errorById[note.id] ? (
                  <p className="text-xs text-red-600">{errorById[note.id]}</p>
                ) : null}
                {!loadingById[note.id] &&
                !errorById[note.id] &&
                contentById[note.id] ? (
                  <div
                    className="text-sm"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("a, button")) {
                        event.stopPropagation();
                      }
                    }}
                  >
                    <PatchNoteMarkdown content={contentById[note.id]} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
