import path from "node:path";
import { lstat, readFile, realpath, stat } from "node:fs/promises";

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

export const readNodePreviewScratchFile = async (
  candidatePath: string,
): Promise<Buffer> => {
  const configuredRoot = process.env.NODE_PREVIEW_SCRATCH_ROOT?.trim();
  if (!configuredRoot) {
    throw new Error("Node preview scratch access is not configured.");
  }
  const root = await realpath(path.resolve(configuredRoot));
  const requested = path.resolve(candidatePath);
  const relative = path.relative(root, requested);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Preview path escapes the worker scratch directory.");
  }
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) {
      throw new Error("Preview path cannot contain symbolic links.");
    }
  }
  const resolved = await realpath(requested);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Preview path escapes the worker scratch directory.");
  }
  const info = await stat(resolved);
  if (!info.isFile() || info.size <= 0 || info.size > MAX_PREVIEW_BYTES) {
    throw new Error("Preview output is not a valid image file.");
  }
  return readFile(resolved);
};
