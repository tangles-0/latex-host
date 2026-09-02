type ParsedVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

export type NodeUpdateInfo = {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
};

export const parseNodeVersion = (value: string): ParsedVersion | null => {
  const match = /^(?:node-)?v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(
    value.trim(),
  );
  if (!match) {
    return null;
  }
  return {
    raw: `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ""}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
};

const compareVersions = (left: ParsedVersion, right: ParsedVersion): number => {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) {
      return left[key] - right[key];
    }
  }
  if (left.prerelease === right.prerelease) {
    return 0;
  }
  if (left.prerelease === null) {
    return 1;
  }
  if (right.prerelease === null) {
    return -1;
  }
  return left.prerelease.localeCompare(right.prerelease, undefined, {
    numeric: true,
  });
};

export const buildNodeUpdateInfo = (
  currentValue: string | undefined,
  tagNames: string[],
): NodeUpdateInfo => {
  const current = currentValue ? parseNodeVersion(currentValue) : null;
  const latest = tagNames
    .filter((tag) => tag.startsWith("node-v"))
    .map(parseNodeVersion)
    .filter((version): version is ParsedVersion => version !== null)
    .reduce<ParsedVersion | null>(
      (best, version) =>
        !best || compareVersions(version, best) > 0 ? version : best,
      null,
    );

  return {
    currentVersion: current?.raw ?? null,
    latestVersion: latest?.raw ?? null,
    updateAvailable: Boolean(
      current && latest && compareVersions(latest, current) > 0,
    ),
  };
};

export const getNodeUpdateInfo = async (): Promise<NodeUpdateInfo> => {
  const currentValue = process.env.LATEX_NODE_VERSION;
  try {
    const response = await fetch(
      "https://api.github.com/repos/tangles-0/latex-host/tags?per_page=100",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "latex-node-update-check",
        },
        next: { revalidate: 60 * 60 },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) {
      return buildNodeUpdateInfo(currentValue, []);
    }
    const tags = (await response.json()) as Array<{ name?: unknown }>;
    return buildNodeUpdateInfo(
      currentValue,
      tags
        .map((tag) => tag.name)
        .filter((name): name is string => typeof name === "string"),
    );
  } catch {
    return buildNodeUpdateInfo(currentValue, []);
  }
};
