# Latex Vercel Migration Outcome (Agent Handoff)

## Purpose

This document captures the current migration state and the key decisions/fixes made so future AI sessions can continue safely without re-discovering the same constraints.

## Outcome Summary

- Runtime target is now Vercel-first (Next.js + Vercel Postgres + Vercel Blob).
- AWS-specific app/runtime code paths were removed from core media/upload storage modules touched during migration.
- Upload flows, share flows, and admin tooling were adapted for Vercel function/storage limitations.
- Async preview worker integration contract is implemented (dispatch + private ingest endpoint), while worker service implementation remains deferred.

## Current Storage Model

- Storage backend in active use: `blob` (with local fallback for development compatibility in some modules).
- Blob access mode is treated as private in media/upload runtime paths.
- Direct public-blob redirects are not used for private file delivery.
- Private media delivery flows through app routes (authenticated or share-validated), with route-level caching headers.

## Blob/Vercel Nuances Encountered and Fixes

### 1) Private store + `access: "public"` mismatch

Problem:
- Requests and uploads failed with errors like:
  - `Cannot use public access on a private store`
  - Redirects to `*.private.blob.vercel-storage.com/...` returning `403`.

Fix:
- Normalized Blob operations to private-mode usage in runtime code paths.
- Stopped treating Blob as the old direct S3 redirect backend in share/media routes.

### 2) Vercel Function body limit vs multipart part-size constraints

Problem:
- Vercel Functions have a 4.5 MB request body limit.
- Blob manual multipart upload requires non-final parts >= 5 MB.
- This made the "classic multipart complete" path incompatible when chunk sizes were function-safe.

Fix:
- Chunk upload payloads were reduced to 4 MB-safe requests.
- Upload transport moved to `application/octet-stream` for chunk part posts (with fallback compatibility).
- Blob session backend changed from manual multipart-complete semantics to:
  1. store each chunk as temp blob part object,
  2. compose ordered parts into final object at complete time,
  3. validate checksum/size,
  4. delete temp part objects.

### 3) Checksum mismatch on resumable uploads

Problem:
- Upload complete failed with `Uploaded file checksum did not match.` for chunked uploads.
- Upload page used a partial file fingerprint for resume lookup but server expected full SHA-256 of full file contents.

Fix:
- Resume checksum source now uses full-file SHA-256 so:
  - session matching and
  - server integrity validation
  use the same value.

### 4) Image staging object duplication

Problem:
- For image uploads via upload sessions, staged object remained at:
  - `/uploads/YYYY/MM/DD/original/<session-id>.<ext>`
- Final image variants were also written under:
  - `/uploads/YYYY/MM/DD/image/original|sm|lg/...`

Fix:
- After successful image processing/storage, staged upload object is deleted.
- This cleanup is applied for all image branches in `storeImageMediaFromBuffer` usage (svg/gif/other raster).

### 5) Private media cache behavior

Problem:
- Authenticated media/image routes used `no-store`, forcing re-fetches on navigation and hurting UX/load.

Fix:
- Added private cache-friendly headers and conditional response support:
  - `Cache-Control: private, max-age=...`
  - `ETag` / `If-None-Match` handling with `304`.

## Upload Behavior Invariants (Current)

- Function-safe chunk size is 4 MB across init/client/session normalization paths.
- Resumable threshold is bounded to Vercel-safe values in settings-related flows.
- Gallery drag/drop "force upload page" UX threshold is decoupled from chunk/resumable threshold and set to 64 MB:
  - files >= 64 MB prompt user to use Upload page (better progress/resume UX),
  - smaller files continue in gallery background flow.

## Share/Access Invariants

- Share URL contract is preserved:
  - file links use extension (`/share/code.ext`) and should return file bytes,
  - album share links are extensionless (`/share/code`).
- Private Blob delivery means app-mediated reads for protected content.

## Admin/Tooling Outcomes

- AWS billing page/backend removed.
- DB push/migration helper endpoint removed.
- SQL import/export retained and refactored for pure app-side operation.
- Storage audit/cleanup tooling added to admin database page.

## Guardrails For Future Agents

- Do not reintroduce public Blob access for protected/private media paths.
- Do not reintroduce manual Blob multipart complete with function-uploaded sub-5MB parts.
- Keep upload checksums as full-file SHA-256 end-to-end.
- Keep share URL shapes and anonymous behavior unchanged.
- Preserve range handling for media playback/seek behavior.
- If changing cache headers, preserve revocation-sensitive behavior for share routes.

## High-Value Regression Checks

1. Large resumable upload:
   - init -> part uploads -> complete succeeds, no checksum mismatch.
2. Upload of each kind:
   - image/video/document/other registration succeeds and media renders.
3. Image upload-session cleanup:
   - staged `/original/<session-id>.<ext>` object removed after successful image finalize.
4. Private media caching:
   - repeat requests can return `304` with `ETag`.
5. Share behavior:
   - `/share/code.ext` returns bytes and supports expected embed/download behavior.

## Deferred/Not Yet Implemented

- External preview worker service itself (contract is present, service implementation deferred).
- Multi-store share optimization (private originals + separate public store) not implemented in current state.

