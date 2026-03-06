# LATEX

Cloud app for hosting and sharing images, videos, audio, documents, and archives.

## Current Deployment Target

Latex is now **Vercel-first**:

- Next.js app + API routes on Vercel
- PostgreSQL via Vercel Postgres-compatible envs
- Object storage via Vercel Blob

Migration status and nuanced decisions are tracked in:

- `.docs/vercel-migration-plan.md`
- `.docs/vercel-migration-outcome.md`

## Key Runtime Notes

- Share URL contract is preserved:
  - file shares: `/share/<code>.<ext>` (returns bytes)
  - album shares: `/share/<code>` (page route)
- Blob storage is used in private-mode delivery paths.
- Private media/image routes now emit browser cache headers + `ETag` handling (`304` support).
- Uploads use function-safe chunking for Vercel limits.

## Upload Constraints (Important)

Vercel Functions have a request body cap (~4.5MB). Current app behavior:

- chunk part size is set to **4MB**
- resumable threshold is normalized to Vercel-safe range
- gallery drag/drop warns and redirects users to Upload page for files >= **64MB**
- Upload page includes progress + resume UX

If you change upload logic, re-check:

- `/api/uploads/init`
- `/api/uploads/part`
- `/api/uploads/complete`
- `src/lib/upload-client.ts`
- `src/lib/upload-sessions.ts`

## Local Development

### 1) Install

```bash
pnpm install
```

### 2) Configure env

Copy `.env.example` to `.env.local` and set at least:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- one Postgres connection string (`DATABASE_URL` or `POSTGRES_URL`)
- `STORAGE_BACKEND=blob` (default in example)
- `BLOB_READ_WRITE_TOKEN`

### 3) Start DB (docker)

```bash
docker compose up -d db
```

### 4) Apply schema

```bash
pnpm db:push
```

### 5) Run app

```bash
pnpm dev
```

App runs on `http://localhost:3000`.

## Useful Scripts

- `pnpm dev` - start local dev server
- `pnpm build` - production build
- `pnpm start` - run built app
- `pnpm lint` - Next lint
- `pnpm db:push` - push Drizzle schema
- `pnpm test` - Vitest unit tests
- `pnpm test:e2e` - Playwright e2e
- `pnpm worker:fake` - fake preview worker harness

## Feature Highlights

- user accounts, groups, and per-group limits
- albums + album ordering/captions
- anonymous hash-based sharing
- image, video, document, archive support
- async preview worker contract (worker service deferred)
- admin import/export + storage consistency audit tools

## Docs Index

- `.docs/vercel-migration-plan.md` - phased migration plan
- `.docs/vercel-migration-outcome.md` - migration outcome + guardrails for new AI sessions
- `.docs/preview-worker-architecture.md` - worker contract/design