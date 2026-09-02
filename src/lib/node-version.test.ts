import { describe, expect, it } from "vitest";

import { buildNodeUpdateInfo, parseNodeVersion } from "@/lib/node-version";

describe("node image versions", () => {
  it("normalizes release tags", () => {
    expect(parseNodeVersion("node-v1.2.3")?.raw).toBe("1.2.3");
    expect(parseNodeVersion("dev")).toBeNull();
  });

  it("finds an available stable update", () => {
    expect(
      buildNodeUpdateInfo("node-v1.2.3", [
        "v9.0.0",
        "node-v1.2.4-beta.1",
        "node-v1.2.4",
      ]),
    ).toEqual({
      currentVersion: "1.2.3",
      latestVersion: "1.2.4",
      updateAvailable: true,
    });
  });

  it("does not flag development or current builds", () => {
    expect(buildNodeUpdateInfo("dev", ["node-v1.2.4"]).updateAvailable).toBe(
      false,
    );
    expect(
      buildNodeUpdateInfo("node-v1.2.4", ["node-v1.2.4"]).updateAvailable,
    ).toBe(false);
  });
});
