import { expect, test } from "@playwright/test";

test.describe("Auth guards for API routes", () => {
  test("rejects unauthenticated preview status access", async ({ request }) => {
    const response = await request.get("/api/media/preview-status?kind=video&mediaId=example");
    expect(response.status()).toBe(401);
  });

  test("rejects unauthenticated upload init", async ({ request }) => {
    const response = await request.post("/api/uploads/init", {
      data: {
        fileName: "test.png",
        fileSize: 1024,
        mimeType: "image/png",
        chunkSize: 1024 * 1024,
      },
    });
    expect(response.status()).toBe(401);
  });
});
