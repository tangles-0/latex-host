import { test, expect } from "@playwright/test"
import { injectNodeSessionCookie } from "./helpers/auth"
import { VISUAL_THEMES, captureThemedPage } from "./helpers/visual"

const nodeBase = process.env.PLAYWRIGHT_NODE_BASE_URL
const nodeUserId = process.env.E2E_NODE_USER_ID
const nextAuthSecret = process.env.NEXTAUTH_SECRET

test.describe("node mode visual", () => {
  test.skip(!nodeBase, "Set PLAYWRIGHT_NODE_BASE_URL to a NODE_MODE=true server")

  test.use({ baseURL: nodeBase })

  for (const theme of VISUAL_THEMES) {
    test(`node home / ${theme}`, async ({ page }) => {
      await captureThemedPage(page, "/", `node-home`, theme)
    })
  }

  test("cloud-only pages 404", async ({ request }) => {
    for (const path of ["/admin", "/messages", "/generate", "/watch/nope"]) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(404)
    }
  })
})

test.describe("node authenticated pages", () => {
  test.skip(
    !nodeBase || !nodeUserId || !nextAuthSecret,
    "Need PLAYWRIGHT_NODE_BASE_URL, E2E_NODE_USER_ID, and NEXTAUTH_SECRET"
  )

  test.use({ baseURL: nodeBase })

  test.beforeEach(async ({ page }) => {
    const injected = await injectNodeSessionCookie(page, nodeBase as string)
    test.skip(!injected, "Unable to inject node session cookie")
  })

  for (const theme of ["dark", "light"] as const) {
    for (const route of [
      { path: "/gallery", name: "gallery" },
      { path: "/upload", name: "upload" },
      { path: "/import", name: "import" },
      { path: "/account", name: "account" }
    ]) {
      test(`${route.name} / ${theme}`, async ({ page }) => {
        await captureThemedPage(page, route.path, `node-${route.name}`, theme)
      })
    }
  }
})
