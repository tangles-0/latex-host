"use client";

import { useRef } from "react";

type NoteRichEditorProps = {
  value: string;
  onChange: (next: string) => void;
  layoutMode?: "windowed" | "large" | "fullscreen";
};

export default function NoteRichEditor({
  value,
  onChange,
  layoutMode = "windowed",
}: NoteRichEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  function focusEditor() {
    editorRef.current?.focus();
  }

  function updateSelection(nextValue: string, start: number, end: number) {
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      if (!editorRef.current) {
        return;
      }
      editorRef.current.focus();
      editorRef.current.setSelectionRange(start, end);
    });
  }

  function applyWrap(prefix: string, suffix: string) {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const fallback =
      prefix === "[" && suffix === "](https://)"
        ? "link text"
        : prefix === "`" && suffix === "`"
          ? "code"
          : "text";
    const content = selected || fallback;
    const nextValue = `${value.slice(0, start)}${prefix}${content}${suffix}${value.slice(end)}`;
    const selectionStart = start + prefix.length;
    const selectionEnd = selectionStart + content.length;
    updateSelection(nextValue, selectionStart, selectionEnd);
  }

  function applyLinePrefix(prefix: string) {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextLineBreak = value.indexOf("\n", end);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const selectedBlock = value.slice(lineStart, lineEnd);
    const prefixedBlock = selectedBlock
      .split("\n")
      .map((line, index) => {
        if (!line.trim() && index === selectedBlock.split("\n").length - 1) {
          return line;
        }
        return `${prefix}${line}`;
      })
      .join("\n");
    const nextValue = `${value.slice(0, lineStart)}${prefixedBlock}${value.slice(lineEnd)}`;
    updateSelection(nextValue, lineStart, lineStart + prefixedBlock.length);
  }

  function insertLink() {
    const href = window.prompt("Link URL");
    if (!href) {
      return;
    }
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || "link text";
    const suffix = `](${href.trim()})`;
    const nextValue = `${value.slice(0, start)}[${selected}${suffix}${value.slice(end)}`;
    updateSelection(nextValue, start + 1, start + 1 + selected.length);
  }

  function applyCodeFormatting() {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);

    if (selected.includes("\n")) {
      const content = selected || "code";
      const fenced = `\`\`\`\n${content}\n\`\`\``;
      const nextValue = `${value.slice(0, start)}${fenced}${value.slice(end)}`;
      const selectionStart = start + 4;
      const selectionEnd = selectionStart + content.length;
      updateSelection(nextValue, selectionStart, selectionEnd);
      return;
    }

    applyWrap("`", "`");
  }

  function handleEnterKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }
    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const textarea = event.currentTarget;
    if (textarea.selectionStart !== textarea.selectionEnd) {
      return;
    }

    const cursor = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
    const nextBreak = value.indexOf("\n", cursor);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const line = value.slice(lineStart, lineEnd);
    const match = /^(\s*)(\d+)\.\s?(.*)$/.exec(line);
    if (!match) {
      return;
    }

    const [, indent, numberText, lineContent] = match;
    const prefixLength = indent.length + numberText.length + 2;
    const contentStart = lineStart + prefixLength;
    const beforeCursorContent = value.slice(contentStart, cursor);
    const afterCursorContent = value.slice(cursor, lineEnd);

    event.preventDefault();

    if (lineContent.trim().length === 0) {
      const nextValue = `${value.slice(0, lineStart)}${value.slice(lineEnd)}`;
      updateSelection(nextValue, lineStart, lineStart);
      return;
    }

    const nextNumber = Number.parseInt(numberText, 10) + 1;
    const currentLine = `${indent}${numberText}. ${beforeCursorContent}`;
    const nextLine = `${indent}${nextNumber}. ${afterCursorContent}`;
    const nextValue = `${value.slice(0, lineStart)}${currentLine}\n${nextLine}${value.slice(lineEnd)}`;
    const nextCursor = lineStart + currentLine.length + 1 + `${indent}${nextNumber}. `.length;
    updateSelection(nextValue, nextCursor, nextCursor);
  }

  return (
    <div
      className={`rounded border border-neutral-200 ${
        layoutMode === "fullscreen" ? "flex h-full min-h-0 flex-col" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-2 text-xs">
        <button type="button" onClick={() => { focusEditor(); applyWrap("**", "**"); }} className="rounded border border-neutral-200 px-2 py-1">
          B
        </button>
        <button type="button" onClick={() => { focusEditor(); applyWrap("*", "*"); }} className="rounded border border-neutral-200 px-2 py-1">
          I
        </button>
        <button type="button" onClick={() => { focusEditor(); applyLinePrefix("# "); }} className="rounded border border-neutral-200 px-2 py-1">
          H1
        </button>
        <button type="button" onClick={() => { focusEditor(); applyLinePrefix("## "); }} className="rounded border border-neutral-200 px-2 py-1">
          H2
        </button>
        <button type="button" onClick={() => { focusEditor(); applyLinePrefix("### "); }} className="rounded border border-neutral-200 px-2 py-1">
          H3
        </button>
        <button type="button" onClick={() => { focusEditor(); applyLinePrefix("> "); }} className="rounded border border-neutral-200 px-2 py-1">
          Quote
        </button>
        <button type="button" onClick={() => { focusEditor(); applyLinePrefix("- "); }} className="rounded border border-neutral-200 px-2 py-1">
          UL
        </button>
        <button type="button" onClick={() => { focusEditor(); applyLinePrefix("1. "); }} className="rounded border border-neutral-200 px-2 py-1">
          OL
        </button>
        <button type="button" onClick={() => { focusEditor(); applyCodeFormatting(); }} className="rounded border border-neutral-200 px-2 py-1">
          Code
        </button>
        <button type="button" onClick={() => { focusEditor(); insertLink(); }} className="rounded border border-neutral-200 px-2 py-1">
          Link
        </button>
      </div>
      <textarea
        ref={editorRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleEnterKey}
        spellCheck={false}
        className={`w-full resize-none overflow-y-auto px-4 py-3 font-mono text-sm outline-none ${
          layoutMode === "fullscreen"
            ? "note-editor-fullscreen-scrollbar min-h-0 flex-1"
            : layoutMode === "large"
              ? "h-[calc(100vh-16rem)]"
              : "min-h-[320px]"
        }`}
      />
    </div>
  );
}
