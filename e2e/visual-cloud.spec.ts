import { test, expect } from "@playwright/test"
import { loginWithCredentials } from "./helpers/auth"
import {
  MOBILE_THEMES,
  VISUAL_THEMES,
  captureThemedPage,
  setTheme,
  assertReadableContrast,
  screenshotPage,
  disableMotion
} from "./helpers/visual"

const PUBLIC_PATHS = [
  { path: "/", name: "home" },
  { path: "/patch-notes", name: "patch-notes" },
  { path: "/report-abuse", name: "report-abuse" },
  { path: "/reset-password", name: "reset-password" },
  { path: "/signout", name: "signout" },
  { path: "/watch/nope", name: "watch-missing" }
]

const USER_PATHS = [
  { path: "/gallery", name: "gallery" },
  { path: "/gallery?tab=albums", name: "albums" },
  { path: "/upload", name: "upload" },
  { path: "/generate", name: "generate" },
  { path: "/messages", name: "messages" },
  { path: "/messages/best-practices", name: "messages-best-practices" },
  { path: "/account", name: "account-profile" },
  { path: "/account?tab=keys", name: "account-keys" },
  { path: "/account?tab=devices", name: "account-devices" },
  { path: "/account?tab=pgp", name: "account-pgp" },
  { path: "/account?tab=nodes", name: "account-nodes" }
]

const ADMIN_PATHS = [
  { path: "/admin", name: "admin-overview" },
  { path: "/admin/users", name: "admin-users" },
  { path: "/admin/groups", name: "admin-groups" },
  { path: "/admin/nodes", name: "admin-nodes" },
  { path: "/admin/limits", name: "admin-limits" },
  { path: "/admin/settings", name: "admin-settings" },
  { path: "/admin/patch-notes", name: "admin-patch-notes" },
  { path: "/admin/abuse", name: "admin-abuse" }
]

const userEmail = process.env.E2E_USER_EMAIL
const userPassword = process.env.E2E_USER_PASSWORD
const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test.describe("visual public pages", () => {
  for (const theme of VISUAL_THEMES) {
    for (const route of PUBLIC_PATHS) {
      test(`${route.name} / ${theme}`, async ({ page }) => {
        await captureThemedPage(page, route.path, `public-${route.name}`, theme)
      })
    }
  }

  for (const theme of MOBILE_THEMES) {
    test(`home mobile / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await captureThemedPage(page, "/", "public-home-mobile", theme)
    })
  }

  test("database admin is gone", async ({ page }) => {
    const response = await page.goto("/admin/database")
    expect(response?.status()).toBe(404)
  })
})

test.describe("visual authenticated user pages", () => {
  test.skip(!userEmail || !userPassword, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD")

  test.beforeEach(async ({ page }) => {
    await loginWithCredentials(page, userEmail as string, userPassword as string)
  })

  for (const theme of VISUAL_THEMES) {
    for (const route of USER_PATHS) {
      test(`${route.name} / ${theme}`, async ({ page }) => {
        await captureThemedPage(page, route.path, `user-${route.name}`, theme)
      })
    }
  }
})

test.describe("visual admin pages", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD")

  test.beforeEach(async ({ page }) => {
    await loginWithCredentials(page, adminEmail as string, adminPassword as string)
  })

  for (const theme of VISUAL_THEMES) {
    for (const route of ADMIN_PATHS) {
      test(`${route.name} / ${theme}`, async ({ page }) => {
        await captureThemedPage(page, route.path, `admin-${route.name}`, theme)
      })
    }
  }

  test("admin user gallery / dark", async ({ page }) => {
    await page.goto("/admin/users")
    const firstUser = page.locator("table a").first()
    if ((await firstUser.count()) === 0) {
      test.skip()
      return
    }
    await firstUser.click()
    await page.waitForURL(/\/admin\/users\/.+\/gallery/)
    await setTheme(page, "dark")
    await assertReadableContrast(page)
    await screenshotPage(page, "admin-user-gallery-dark")
  })
})

test.describe("loading skeletons", () => {
  test.skip(!userEmail || !userPassword, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD")

  test("gallery loading modal contrast", async ({ page }) => {
    await loginWithCredentials(page, userEmail as string, userPassword as string)
    await page.route("**/api/**", async route => {
      await new Promise(resolve => setTimeout(resolve, 2500))
      await route.continue()
    })
    await page.goto("/gallery")
    await setTheme(page, "dark")
    await disableMotion(page)
    const modal = page.getByRole("dialog", { name: /loading ur gallery/i })
    if (await modal.isVisible().catch(() => false)) {
      await assertReadableContrast(page)
      await screenshotPage(page, "loading-gallery-dark", { fullPage: false })
    }
  })
})
