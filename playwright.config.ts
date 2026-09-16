import { defineConfig, devices } from "@playwright/test"

const cloudURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled"
    }
  },
  use: {
    baseURL: cloudURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "pnpm dev",
    url: cloudURL,
    reuseExistingServer: true,
    timeout: 180_000
  },
  projects: [
    {
      name: "cloud",
      testIgnore: /visual-node\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }
    },
    {
      name: "node",
      testMatch: /visual-node\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        baseURL: process.env.PLAYWRIGHT_NODE_BASE_URL ?? "http://127.0.0.1:3001"
      }
    }
  ]
})
