import { readFile } from "node:fs/promises";
import path from "node:path";

const PGP_BEST_PRACTICES_PATH = path.join(
  process.cwd(),
  "public",
  "docs",
  "pgp-messaging-best-practices.md",
);

export const readPgpBestPracticesMarkdown = async () => {
  return readFile(PGP_BEST_PRACTICES_PATH, "utf8");
};
