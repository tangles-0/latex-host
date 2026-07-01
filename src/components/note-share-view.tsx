"use client";

import { useState } from "react";
import NoteMarkdown from "@/components/note-markdown";

const noteShareDateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function formatUpdatedAt(updatedAt: string): string {
  return noteShareDateTimeFormatter.format(new Date(updatedAt));
}

export default function NoteShareView({
  shareCode,
  fileName,
  content,
  updatedAt,
  requiresPassword = false,
}: {
  shareCode: string;
  fileName: string;
  content?: string;
  updatedAt?: string;
  requiresPassword?: boolean;
}) {
  const [mode, setMode] = useState<"rich" | "markdown">("rich");
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const hasContent = typeof content === "string";

  async function copyContents() {
    if (!hasContent) {
      return;
    }
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function unlockShare() {
    const nextPassword = password.trim();
    if (!nextPassword) {
      setPasswordError("Enter the share password.");
      return;
    }
    setPasswordError(null);
    setIsUnlocking(true);
    try {
      const response = await fetch(
        `/api/public/note-shares/${encodeURIComponent(shareCode)}/unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: nextPassword }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to unlock note.");
      }
      window.location.reload();
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Unable to unlock note.",
      );
      setIsUnlocking(false);
    }
  }

  if (!hasContent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-10">
        <header>
          <h1 className="text-2xl font-semibold">{fileName}</h1>
          {updatedAt ? (
            <p className="mt-1 text-xs text-neutral-500">
              Updated {formatUpdatedAt(updatedAt)}
            </p>
          ) : null}
        </header>

        {requiresPassword ? (
          <form
            className="max-w-md rounded border border-neutral-200 bg-white p-4 text-sm shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              void unlockShare();
            }}
          >
            <label
              className="block text-xs font-medium text-neutral-600"
              htmlFor="note-share-password"
            >
              Password
            </label>
            <input
              id="note-share-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded border border-neutral-200 px-3 py-2"
              autoComplete="current-password"
            />
            {passwordError ? (
              <p className="mt-2 text-xs text-red-600">{passwordError}</p>
            ) : null}
            <button
              type="submit"
              disabled={isUnlocking}
              className="mt-3 rounded bg-black px-3 py-2 text-xs text-white disabled:opacity-50"
            >
              {isUnlocking ? "Unlocking..." : "Unlock note"}
            </button>
          </form>
        ) : (
          <p className="rounded border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
            This note is unavailable.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fileName}</h1>
          {updatedAt ? (
            <p className="mt-1 text-xs text-neutral-500">
              Updated {formatUpdatedAt(updatedAt)}
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
