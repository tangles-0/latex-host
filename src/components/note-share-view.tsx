"use client";

import { useState } from "react";
import NoteMarkdown from "@/components/note-markdown";
import { PageScaffold } from "@/components/ui/page-scaffold";
import { SectionHeader } from "@/components/ui/section-header";
import { TermButton } from "@/components/ui/term-button";
import { TermInput, TermTextarea } from "@/components/ui/term-input";

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
      <PageScaffold>
        <SectionHeader
          title={fileName}
          subtitle={updatedAt ? `Updated ${formatUpdatedAt(updatedAt)}` : undefined}
        />

        {requiresPassword ? (
          <form
            className="max-w-md border border-neutral-200 bg-[var(--theme-card)] p-4 text-sm"
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
            <TermInput
              id="note-share-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full"
              autoComplete="current-password"
            />
            {passwordError ? (
              <p className="mt-2 text-xs text-red-600">{passwordError}</p>
            ) : null}
            <TermButton
              type="submit"
              variant="primary"
              disabled={isUnlocking}
              className="mt-3"
            >
              {isUnlocking ? "Unlocking..." : "Unlock note"}
            </TermButton>
          </form>
        ) : (
          <p className="border border-neutral-200 bg-[var(--theme-card)] p-4 text-sm text-neutral-600">
            This note is unavailable.
          </p>
        )}
      </PageScaffold>
    );
  }

  return (
    <PageScaffold>
      <SectionHeader
        title={fileName}
        subtitle={updatedAt ? `Updated ${formatUpdatedAt(updatedAt)}` : undefined}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <TermButton
              active={mode === "rich"}
              onClick={() => setMode("rich")}
            >
              rich text
            </TermButton>
            <TermButton
              active={mode === "markdown"}
              onClick={() => setMode("markdown")}
            >
              raw markdown
            </TermButton>
            <TermButton onClick={() => void copyContents()}>
              {copied ? "Copied" : "Copy"}
            </TermButton>
          </div>
        }
      />

      {mode === "rich" ? (
        <div className="border border-neutral-200 bg-[var(--theme-card)] p-4 sm:p-6">
          <NoteMarkdown content={content} />
        </div>
      ) : (
        <TermTextarea
          readOnly
          value={content}
          className="min-h-[60vh] w-full font-mono text-sm"
        />
      )}
    </PageScaffold>
  );
}
