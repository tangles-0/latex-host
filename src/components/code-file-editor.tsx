"use client";

import Editor from "@monaco-editor/react";
import { monacoLanguageFromExt } from "@/lib/media-types";

type CodeFileEditorProps = {
  value: string;
  onChange: (next: string) => void;
  ext: string;
  readOnly?: boolean;
  layoutMode?: "windowed" | "large" | "fullscreen";
  onSave?: () => void;
};

export default function CodeFileEditor({
  value,
  onChange,
  ext,
  readOnly = false,
  layoutMode = "windowed",
  onSave,
}: CodeFileEditorProps) {
  const language = monacoLanguageFromExt(ext);
  const isFullscreen = layoutMode === "fullscreen";
  const editorHeight =
    layoutMode === "fullscreen"
      ? "100%"
      : layoutMode === "large"
        ? "calc(100vh - 16rem)"
        : "320px";

  return (
    <div
      className={
        isFullscreen
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded border border-neutral-200"
          : "overflow-hidden rounded border border-neutral-200"
      }
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          onSave?.();
        }
      }}
    >
      <Editor
        height={editorHeight}
        language={language}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        theme="vs"
        options={{
          readOnly,
          minimap: { enabled: layoutMode !== "windowed" },
          fontSize: 13,
          lineNumbers: "on",
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          renderWhitespace: "selection",
          padding: { top: 8, bottom: 8 },
        }}
        loading={
          <div className="flex h-full min-h-[320px] items-center justify-center bg-neutral-50 text-sm text-neutral-500">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
