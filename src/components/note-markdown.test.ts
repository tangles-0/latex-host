import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NoteMarkdown from "@/components/note-markdown";

describe("NoteMarkdown", () => {
  it("renders inline and display LaTeX with KaTeX", () => {
    const html = renderToStaticMarkup(
      createElement(NoteMarkdown, {
        content: "Inline $x^2$.\n\n$$\\int_0^1 x\\,dx$$",
      }),
    );

    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
  });
});
