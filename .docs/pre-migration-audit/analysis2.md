# Upload + Preview Security Findings

- **Issue:** Upload integrity is not enforced end-to-end; `checksum` is accepted but never validated against reassembled content, and completion does not verify assembled byte length against declared `fileSize`.
  **Recommended action:** Verify cryptographic digest (e.g., SHA-256) and exact final size during completion, and fail sessions that do not match.

- **Issue:** Upload completion accepts whatever parts exist in `uploadedParts`; there is no strict contiguous part coverage check (`1..totalParts`) before finalize.
  **Recommended action:** Enforce full ordered part set presence before completion and reject missing/duplicate/inconsistent part metadata.

- **Issue:** Chunk upload path buffers full multipart payloads into memory (`formData` + `arrayBuffer`) without server-side hard caps per request.
  **Recommended action:** Add strict request body limits and stream chunks directly to storage to avoid memory exhaustion.

- **Issue:** Local backend reassembles uploads with `Buffer.concat(buffers)` for all parts, creating O(file size) peak RAM usage and easy DoS with large uploads.
  **Recommended action:** Reassemble via streaming write pipeline (append/pipe parts to output) instead of full in-memory concat.

- **Issue:** Untrusted files are parsed by high-risk native tools (`ffmpeg`, `pdftoppm`, `soffice`, image codecs) in the main app trust boundary.
  **Recommended action:** Isolate conversion in a hardened sandbox/worker (seccomp/AppArmor, low privileges, no network, cgroup quotas) and treat parser crashes as expected.

- **Issue:** Child process environment forwards full `process.env` to `soffice`, increasing blast radius if parser compromise occurs.
  **Recommended action:** Use a minimal allowlisted environment for child processes; do not pass sensitive runtime secrets.

- **Issue:** File type trust relies heavily on client-provided MIME + extension for classification/processing decisions.
  **Recommended action:** Perform server-side magic-byte/content sniffing and enforce allowlist by detected type before parsing or storage.

- **Issue:** Error logging includes raw process stderr/stdout and temp paths, which may leak sensitive internals and attacker-controlled content into logs.
  **Recommended action:** Sanitize and bound log output, strip secrets/paths, and log structured error codes rather than full tool output in production.

- **Issue:** Shared-file responses use permissive `Access-Control-Allow-Origin: *` across types and do not set defensive headers like `X-Content-Type-Options: nosniff`.
  **Recommended action:** Restrict CORS by resource class, add `nosniff`, and harden inline-serving behavior for active formats (especially SVG).
