# Playwright E2E Tests

These tests run against an already-running local Latex instance.

## Run

1. Start the app (in another shell):
   - `pnpm dev`
2. Run tests:
   - `pnpm test:e2e`

## Custom base URL

If your app is running on a different origin:

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm test:e2e`
