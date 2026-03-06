import { expect, test } from "@playwright/test";

test.describe("Public share route", () => {
  test("returns placeholder image for unknown share", async ({ request }) => {
    const response = await request.get("/share/nonExistentShareCode123.png");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
  });
});
