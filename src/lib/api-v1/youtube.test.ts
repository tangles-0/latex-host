import { describe, expect, it } from "vitest";
import {
  createYoutubeAudioIngestBodySchema,
  createYoutubeVideoIngestBodySchema,
} from "@/lib/api-v1/schemas";
import { toYoutubeIngestResource } from "@/lib/api-v1/youtube";
import type { YoutubeIngestEntry } from "@/lib/youtube-ingests";

describe("api v1 youtube schemas", () => {
  it("requires url + qualityId for video ingest", () => {
    expect(
      createYoutubeVideoIngestBodySchema.safeParse({ url: "https://youtu.be/a" })
        .success,
    ).toBe(false);
    expect(
      createYoutubeVideoIngestBodySchema.safeParse({
        url: "https://youtu.be/a",
        qualityId: "22",
      }).success,
    ).toBe(true);
  });

  it("requires only url for audio ingest", () => {
    expect(createYoutubeAudioIngestBodySchema.safeParse({}).success).toBe(false);
    expect(
      createYoutubeAudioIngestBodySchema.safeParse({
        url: "https://youtu.be/a",
      }).success,
    ).toBe(true);
  });

  it("builds kind-specific self links", () => {
    const base: Omit<YoutubeIngestEntry, "outputType"> = {
      id: "ing-1",
      userId: "u1",
      youtubeId: "abc",
      youtubeUrl: "https://youtu.be/abc",
      title: "t",
      status: "pending",
      progress: 0,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    expect(
      toYoutubeIngestResource({ ...base, outputType: "video" }).links.self,
    ).toBe("/api/v1/youtube/video/ingests/ing-1");
    expect(
      toYoutubeIngestResource({ ...base, outputType: "audio" }).links.self,
    ).toBe("/api/v1/youtube/audio/ingests/ing-1");
  });
});
