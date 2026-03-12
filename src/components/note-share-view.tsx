"use client";

import { useState } from "react";
import NoteMarkdown from "@/components/note-markdown";

export default function NoteShareView({
  fileName,
  content,
  updatedAt,
}: {
  fileName: string;
  content: string;
  updatedAt?: string;
}) {
  const [mode, setMode] = useState<"rich" | "markdown">("rich");
  const [copied, setCopied] = useState(false);

  async function copyContents() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fileName}</h1>
          {updatedAt ? (
            <p className="mt-1 text-xs text-neutral-500">
              Updated {new Date(updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setMode("rich")}
            className={`rounded px-3 py-1 ${mode === "rich" ? "bg-black text-white" : "border border-neutral-200"}`}
          >
            rich text
          </button>
          <button
            type="button"
            onClick={() => setMode("markdown")}
            className={`rounded px-3 py-1 ${mode === "markdown" ? "bg-black text-white" : "border border-neutral-200"}`}
          >
            raw markdown
          </button>
          <button
            type="button"
            onClick={() => void copyContents()}
            className="rounded border border-neutral-200 px-3 py-1"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </header>

      {mode === "rich" ? (
        <div className="rounded border border-neutral-200 bg-white p-4 sm:p-6">
          <NoteMarkdown content={content} />
        </div>
      ) : (
        <textarea
          readOnly
          value={content}
          className="min-h-[60vh] w-full rounded border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm"
        />
      )}
    </main>
  );
}
