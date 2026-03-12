"use client";

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";

function normalizeMarkdown(input: string): string {
  return input.replace(/\[([a-z][a-z0-9+.-]*:\/\/[^\]]+)\]\(([^)]+)\)/gi, "[$2]($1)");
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mt-5 text-2xl font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-4 text-xl font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-neutral-300 pl-4 italic text-neutral-700">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-neutral-300" />,
  code: ({ children }) => (
    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.95em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-sm [&_code]:!bg-transparent [&_code]:!p-0 [&_code]:!rounded-none">
      {children}
    </pre>
  ),
  a: ({ href, children }) => {
    if (!href) return <>{children}</>;
    const external = /^https?:\/\//i.test(href);
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" className="underline">
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className="underline">
        {children}
      </Link>
    );
  },
  img: ({ src, alt }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        className="my-4 h-auto max-w-full rounded border border-neutral-200"
      />
    ) : null,
};

export default function NoteMarkdown({
  content,
  emptyFallback = "_Nothing here yet._",
}: {
  content: string;
  emptyFallback?: string;
}) {
  const normalized = normalizeMarkdown(content.trim().length > 0 ? content : emptyFallback);
  return <ReactMarkdown components={markdownComponents}>{normalized}</ReactMarkdown>;
}
