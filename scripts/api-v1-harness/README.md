# API v1 harness

Validates the public `/api/v1` surface against a running app (local or production).

## Setup

1. Create an API key on `/account` (copy it once).
2. Point the harness at your target:

```bash
export API_V1_BASE_URL=http://127.0.0.1:3000
export API_V1_KEY=lh_live_…
pnpm test:api-v1
```

Production example:

```bash
API_V1_BASE_URL=https://your-domain.example API_V1_KEY=lh_live_… pnpm test:api-v1
```

Set `API_V1_KEEP_UPLOADS=true` to skip DELETE cleanup.

## Coverage

- 401 without key
- Discovery limits / docs / OpenAPI
- Simple private + public uploads (share URL fetch)
- Size gates (`use_multipart` / `use_simple_upload`)
- Multipart upload (server or vercel-blob transport)
- Disallowed type 415
- Notes CRUD + share
- File share create/revoke
- Preview polling + thumbnail content download
- Cleanup via DELETE
