import { expect, type Page } from "@playwright/test"

export const VISUAL_THEMES = [
  "dark",
  "light",
  "author",
  "depth",
  "neon-green",
  "retro",
  "cyber",
  "blood",
  "robot",
  "crt"
] as const

export type VisualTheme = (typeof VISUAL_THEMES)[number]

export const MOBILE_THEMES: VisualTheme[] = ["dark", "light"]

export const setTheme = async (page: Page, theme: string): Promise<void> => {
  await page.addInitScript(next => {
    try {
      window.localStorage.setItem("latex-theme", next)
    } catch {
      // ignore
    }
    const apply = () => {
      if (document.documentElement.dataset.theme !== next) {
        document.documentElement.dataset.theme = next
      }
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    })
  }, theme)
  await page.evaluate(next => {
    try {
      window.localStorage.setItem("latex-theme", next)
    } catch {
      // ignore
    }
    document.documentElement.dataset.theme = next
  }, theme)
}

export const disableMotion = async (page: Page): Promise<void> => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `
  })
}

export const screenshotPage = async (
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<void> => {
  await disableMotion(page)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: options?.fullPage ?? true,
    animations: "disabled",
    maxDiffPixelRatio: 0.03,
    mask: [
      page.locator("[data-visual-mask]"),
      page.locator(".gallery-loading-message"),
      page.locator("nextjs-portal"),
      page.getByRole("button", { name: /issue/i })
    ]
  })
}

export const assertReadableContrast = async (page: Page): Promise<void> => {
  const issues = await page.evaluate(() => {
    const parseColor = (value: string) => {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/)
      if (!match) {
        return null
      }
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] === undefined ? 1 : Number(match[4])
      }
    }

    const luminance = (color: { r: number; g: number; b: number }) => {
      const channel = [color.r, color.g, color.b].map(value => {
        const next = value / 255
        return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2]
    }

    const contrastRatio = (
      a: { r: number; g: number; b: number },
      b: { r: number; g: number; b: number }
    ) => {
      const first = luminance(a)
      const second = luminance(b)
      const lighter = Math.max(first, second)
      const darker = Math.min(first, second)
      return (lighter + 0.05) / (darker + 0.05)
    }

    const effectiveBackground = (element: Element) => {
      let current: Element | null = element
      while (current) {
        const parsed = parseColor(getComputedStyle(current).backgroundColor)
        if (parsed && parsed.a >= 0.85) {
          return parsed
        }
        current = current.parentElement
      }
      return parseColor(getComputedStyle(document.body).backgroundColor)
    }

    const found: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node: Node | null = walker.nextNode()
    while (node) {
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? ""
      if (text.length < 2) {
        node = walker.nextNode()
        continue
      }
      const element = node.parentElement
      if (!element) {
        node = walker.nextNode()
        continue
      }
      const style = getComputedStyle(element)
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
        node = walker.nextNode()
        continue
      }
      const rect = element.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) {
        node = walker.nextNode()
        continue
      }
      const color = parseColor(style.color)
      const background = effectiveBackground(element)
      if (!color || !background) {
        node = walker.nextNode()
        continue
      }
      const textLum = luminance(color)
      const bgLum = luminance(background)
      if (textLum < 0.05 && bgLum < 0.12) {
        found.push(`dark-on-dark “${text.slice(0, 48)}”`)
      }
      if (textLum > 0.92 && bgLum > 0.88) {
        found.push(`light-on-light “${text.slice(0, 48)}”`)
      }
      if (contrastRatio(color, background) < 1.5) {
        found.push(`low-contrast(${contrastRatio(color, background).toFixed(2)}) “${text.slice(0, 48)}”`)
      }
      node = walker.nextNode()
    }
    return found.slice(0, 25)
  })

  expect(issues, issues.join("\n")).toEqual([])
}

export const captureThemedPage = async (
  page: Page,
  path: string,
  snapshotName: string,
  theme: string
): Promise<void> => {
  await setTheme(page, theme)
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await setTheme(page, theme)
  await page.waitForFunction(next => document.documentElement.dataset.theme === next, theme)
  await page.waitForTimeout(80)
  await assertReadableContrast(page)
  await screenshotPage(page, `${snapshotName}-${theme}`)
}
