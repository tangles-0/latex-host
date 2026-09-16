import { encode } from "next-auth/jwt"
import type { Page } from "@playwright/test"

export const loginWithCredentials = async (
  page: Page,
  email: string,
  password: string
): Promise<void> => {
  await page.goto("/")
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page
    .locator("form")
    .filter({ has: page.locator('input[name="email"]') })
    .locator('button[type="submit"]')
    .click()
  await page.waitForURL(/\/gallery/, { timeout: 20_000 })
}

export const injectNodeSessionCookie = async (
  page: Page,
  baseURL: string
): Promise<boolean> => {
  const secret = process.env.NEXTAUTH_SECRET
  const userId = process.env.E2E_NODE_USER_ID
  const email = process.env.E2E_USER_EMAIL ?? "node-e2e@example.com"
  const name = process.env.E2E_NODE_USERNAME ?? "node-e2e"
  if (!secret || !userId) {
    return false
  }

  const token = await encode({
    token: {
      sub: userId,
      email,
      name
    },
    secret
  })

  const url = new URL(baseURL)
  await page.context().addCookies([
    {
      name: url.protocol === "https:" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax"
    }
  ])
  return true
}
