# Preview Worker Architecture (Worker-Ready, Not Yet Deployed)

## Goal

Define an implementation-ready async preview worker architecture that integrates with the app contract already implemented:

- app emits preview work request after upload completion,
- worker generates preview image,
- worker posts preview result into private ingest endpoint,
- app updates `previewStatus` (`pending -> processing -> ready|failed`).

## Existing App Contract

### Dispatch contract (app -> worker webhook)

- Source: `POST` from app backend to `PREVIEW_WORKER_WEBHOOK_URL`
- Auth: optional `Authorization: Bearer ${PREVIEW_WORKER_WEBHOOK_SECRET}`
- Body:

```json
{
  "mediaId": "uuid",
  "kind": "video | document | other"
}
```

### Ingest contract (worker -> app private endpoint)

- Target: `POST /api/internal/preview-ingest`
- Auth:
  - `Authorization: Bearer ${PREVIEW_WORKER_INGEST_SECRET}` OR
  - `x-worker-ingest-token: ${PREVIEW_WORKER_INGEST_SECRET}`
- Body success:

```json
{
  "mediaId": "uuid",
  "kind": "video | document | other",
  "previewBase64": "data:image/png;base64,..."
}
```

- Body failure:

```json
{
  "mediaId": "uuid",
  "kind": "video | document | other",
  "error": "failure reason"
}
```

## Recommended Worker Runtime

- Containerized worker service (Fly/Render/ECS/Fargate/Cloud Run) with:
  - `ffmpeg`,
  - `poppler-utils` (`pdftoppm`),
  - `libreoffice` (`soffice`),
  - optional OCR/AV tooling later.
- Queue-triggered, not request-synchronous.

## Queue/Retry Design

### Queue message schema

```json
{
  "jobId": "uuid",
  "mediaId": "uuid",
  "kind": "video | document | other",
  "attempt": 1,
  "enqueuedAt": "iso8601"
}
```

### Idempotency

- Idempotency key: `${mediaId}:${kind}`
- Worker should:
  - read current preview status before expensive work when feasible,
  - skip if already `ready`,
  - safely re-run if prior attempt failed.

### Retry policy

- Max attempts: 5
- Backoff: exponential with jitter (`15s, 45s, 2m, 5m, 10m`)
- DLQ after max attempts with final failure record.

## Capability Matrix (Future Worker Scope)

- `video`: frame extraction, black-frame avoidance, optional waveform.
- `document`: PDF first-page render, office conversion then render, richer DOCX snapshot.
- `other`: file-type-specific placeholder/thumbnail, optional audio waveform.
- nice-to-have later: 360 media handling and richer scene-based keyframe selection.

## Black-Frame-Aware Video Strategy

- Sample multiple timestamps (e.g. 1s, 5%, 15%, 30%).
- Score candidates for luminance and entropy.
- Reject near-black / near-static frames.
- Choose highest-scoring candidate, then resize to `lg` and `sm`.

## Storage and Key Conventions

- Keep current app key scheme for derivatives:
  - `uploads/YYYY/MM/DD/<kind>/sm/<baseName>.png`
  - `uploads/YYYY/MM/DD/<kind>/lg/<baseName>.png`
- Worker should not write directly to storage yet (current contract sends base64 to app ingest).
- Future optimization: worker writes binary directly to Blob and only sends metadata pointers.

## Security

- Keep ingest endpoint private and secret-protected.
- Rotate `PREVIEW_WORKER_INGEST_SECRET` periodically.
- Restrict worker egress and credentials to minimum.
- Enforce payload size limits (base64 preview max) in worker and app endpoint.

## Observability

- Log at least:
  - `jobId`, `mediaId`, `kind`, `attempt`, `durationMs`, `result`.
- Emit metrics:
  - queue depth, success rate, retry rate, DLQ count, p95 processing time.
- Add alerting on sustained failure rate and queue backlog growth.

## Local Development Harness

- Use `scripts/dev/fake-preview-worker.mjs` to simulate worker callbacks.
- This validates private ingest auth, payload shape, state transitions, and storage writes without deploying a worker.
