# Playwright E2E Tests

These tests run against an already-running local Latex instance when possible (`reuseExistingServer`).

Contrast checks fail near-black-on-dark and near-white-on-light chrome, plus text below ~1.5:1 (invisible). Make muted green is intentionally below WCAG AA and is not treated as a failure.

## Run

1. Start the app (in another shell):
   - `pnpm dev`
2. Run tests:
   - `pnpm test:e2e`

Authenticated visual coverage needs credentials in `.env.local`:

- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`

Node-mode visuals need a second process (`NODE_MODE=true`, separate checkout or `distDir`) and:

- `PLAYWRIGHT_NODE_BASE_URL=http://127.0.0.1:3001`
- Authenticated node pages also need `NEXTAUTH_SECRET` and `E2E_NODE_USER_ID` (JWT cookie; cloud credentials cannot log into node mode)

Update screenshot baselines:

- `pnpm exec playwright test --update-snapshots`

## Custom base URL

If your app is running on a different origin:

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm test:e2e`
