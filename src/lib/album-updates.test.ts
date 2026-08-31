import { describe, expect, it } from "vitest";
import { parseAlbumPatchPayload } from "@/lib/album-updates";

describe("parseAlbumPatchPayload", () => {
  it("rejects empty payloads", () => {
    expect(parseAlbumPatchPayload({})).toEqual({
      ok: false,
      error: "No album updates provided.",
      status: 400,
    });
  });

  it("rejects blank album names", () => {
    expect(parseAlbumPatchPayload({ name: "   " })).toEqual({
      ok: false,
      error: "Album name is required.",
      status: 400,
    });
  });

  it("accepts either display flag on its own", () => {
    expect(parseAlbumPatchPayload({ displayAsDownloadPage: true })).toEqual({
      ok: true,
      updates: {
        name: undefined,
        displayAsDownloadPage: true,
        displayAsCompactView: undefined,
      },
    });
    expect(parseAlbumPatchPayload({ displayAsCompactView: false })).toEqual({
      ok: true,
      updates: {
        name: undefined,
        displayAsDownloadPage: undefined,
        displayAsCompactView: false,
      },
    });
  });

  it("accepts both display flags together", () => {
    expect(
      parseAlbumPatchPayload({
        displayAsDownloadPage: true,
        displayAsCompactView: true,
      }),
    ).toEqual({
      ok: true,
      updates: {
        name: undefined,
        displayAsDownloadPage: true,
        displayAsCompactView: true,
      },
    });
  });
});
