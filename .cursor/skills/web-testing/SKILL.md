---
name: web-testing
description: >-
  Tests Latex APIs, business rules, and user flows. Use when implementing,
  fixing, or refactoring authenticated web and media features.
---

# Web testing

- Unit/integration runner: Vitest
- End-to-end runner: Playwright
- Unit tests: colocated `*.test.ts` files under `src/`
- E2E tests: `e2e/`
- Install: `pnpm install`
- Unit tests: `pnpm test`
- E2E tests: `pnpm test:e2e`
- Visual snapshots: `pnpm exec playwright test --update-snapshots`
- Types: `pnpm exec tsc --noEmit`
- Lint: `pnpm lint:es .`
- Production build: `pnpm build`

Visual e2e covers each page × theme (and node mode when `PLAYWRIGHT_NODE_BASE_URL` is set), plus contrast checks for dark-on-dark / light-on-light chrome. Optional credentials: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`. Node authenticated pages need `NEXTAUTH_SECRET` and `E2E_NODE_USER_ID`.

Test validation, authorization, limits, state transitions, and critical user
flows. Mock worker/network boundaries in unit tests.
