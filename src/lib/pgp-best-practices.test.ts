import { describe, expect, it } from "vitest";

import { readPgpBestPracticesMarkdown } from "@/lib/pgp-best-practices";

describe("readPgpBestPracticesMarkdown", () => {
  it("loads the bundled PGP and operational-security guidance", async () => {
    const markdown = await readPgpBestPracticesMarkdown();

    expect(markdown).toContain(
      "# PGP messaging: what is it, how it works, and how to use it safely",
    );
    expect(markdown).toContain("## How PGP messaging works, in general");
    expect(markdown).toContain("## How PGP messaging works here on latex.gg");
    expect(markdown).toContain("## What PGP does not protect you from");
    expect(markdown).toContain("## Quick checklist");
  });
});
