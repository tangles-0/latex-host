export type AlbumPatchUpdates = {
  name?: string;
  displayAsDownloadPage?: boolean;
  displayAsCompactView?: boolean;
};

export type AlbumPatchParseResult =
  | { ok: true; updates: AlbumPatchUpdates }
  | { ok: false; error: string; status: 400 };

export const parseAlbumPatchPayload = (
  payload: unknown,
): AlbumPatchParseResult => {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, error: "No album updates provided.", status: 400 };
  }

  const body = payload as {
    name?: unknown;
    displayAsDownloadPage?: unknown;
    displayAsCompactView?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const displayAsDownloadPage =
    typeof body.displayAsDownloadPage === "boolean"
      ? body.displayAsDownloadPage
      : undefined;
  const displayAsCompactView =
    typeof body.displayAsCompactView === "boolean"
      ? body.displayAsCompactView
      : undefined;

  if (name !== undefined && !name) {
    return { ok: false, error: "Album name is required.", status: 400 };
  }
  if (
    name === undefined &&
    displayAsDownloadPage === undefined &&
    displayAsCompactView === undefined
  ) {
    return { ok: false, error: "No album updates provided.", status: 400 };
  }

  return {
    ok: true,
    updates: {
      name,
      displayAsDownloadPage,
      displayAsCompactView,
    },
  };
};
