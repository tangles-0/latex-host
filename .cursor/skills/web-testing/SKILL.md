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
- E2E tests: `tests/`
- Install: `pnpm install`
- Unit tests: `pnpm test`
- E2E tests: `pnpm test:e2e`
- Types: `pnpm exec tsc --noEmit`
- Lint: `pnpm lint:es .`
- Production build: `pnpm build`

Test validation, authorization, limits, state transitions, and critical user
flows. Mock worker/network boundaries in unit tests.
