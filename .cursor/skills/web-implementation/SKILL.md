---
name: web-implementation
description: >-
  Implements authenticated Latex web features using the existing app, storage,
  and database architecture. Use when changing UI, APIs, media, or data models.
---

# Web implementation

## Stack

- Next.js 15 App Router, React 19, and TypeScript
- Tailwind CSS
- PostgreSQL with Drizzle ORM
- NextAuth session authentication
- Vercel Functions/private Vercel Blob for cloud, or Docker/local storage in `NODE_MODE`
- pnpm

## Layout and conventions

- Pages and routes: `src/app/`
- Shared UI: `src/components/`
- Domain/data logic: `src/lib/`
- Schema and migrations: `src/db/`
- Keep authorization server-side and validate API payloads with Zod.
- Image generation (`/generate`) supports text-to-image and image-to-image against the existing Lustify API (`/sdapi/v1/txt2img` and `/sdapi/v1/img2img`). Optional user-drawn masks are PNG base64, white = editable.
- Reuse multipart upload sessions; never proxy large bodies through Vercel.
- Keep node management APIs cloud-only and mounted-file APIs node-only.
- Public node bytes use no-store 307 redirects; management and imports require a local authenticated session.
- Follow `.agent/CODESTYLEGUIDE.md`, the frontend checklist, and `.agent/THEME.md` (observe the theme; do not fake dark overlays with remapped `bg-black` / `text-white`).
- Apply schema changes with `pnpm db:push`.
- Document new environment variables in `.env.example`.

## Verification

Read `.cursor/skills/web-testing/SKILL.md`, then run its checks before handoff.
