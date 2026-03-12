"use client";

import { useMemo, useRef } from "react";

type NoteRichEditorProps = {
  value: string;
  onChange: (next: string) => void;
  fullScreen?: boolean;
};

type ToolbarAction =
  | { label: string; wrap: [string, string] }
  | { label: string; prefix: string }
  | { label: string; code: true }
  | { label: string; run: () => void };

export default function NoteRichEditor({
  value,
  onChange,
  fullScreen = false,
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

  const actions = useMemo<ToolbarAction[]>(
    () => [
      { label: "B", wrap: ["**", "**"] },
      { label: "I", wrap: ["*", "*"] },
      { label: "H1", prefix: "# " },
      { label: "H2", prefix: "## " },
      { label: "H3", prefix: "### " },
      { label: "Quote", prefix: "> " },
      { label: "UL", prefix: "- " },
      { label: "OL", prefix: "1. " },
      { label: "Code", code: true },
      { label: "Link", run: insertLink },
    ],
    [insertLink],
  );

  return (
    <div className={`rounded border border-neutral-200 ${fullScreen ? "h-full" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-2 text-xs">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              focusEditor();
              if ("run" in action) {
                action.run();
                return;
              }
              if ("code" in action) {
                applyCodeFormatting();
                return;
              }
              if ("wrap" in action) {
                applyWrap(action.wrap[0], action.wrap[1]);
                return;
              }
              applyLinePrefix(action.prefix);
            }}
            className="rounded border border-neutral-200 px-2 py-1"
          >
            {action.label}
          </button>
        ))}
      </div>
      <textarea
        ref={editorRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleEnterKey}
        spellCheck={false}
        className={`w-full resize-none overflow-y-auto px-4 py-3 font-mono text-sm outline-none ${fullScreen ? "h-[calc(100vh-16rem)]" : "min-h-[320px]"}`}
      />
    </div>
  );
}
