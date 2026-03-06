# Upload/Preview Pipeline Security Audit (concise)

- **Issue:** Upload completion does not verify all expected parts are present, does not enforce per-part sizes, and does not validate final size/checksum before marking a session `complete`.
  **Recommended action:** On completion, require exact part set `1..totalParts`, enforce expected byte size per part (except final part), and verify final object size and checksum against session metadata before accepting.

- **Issue:** Chunk size is effectively client-controlled (`init` only applies a minimum), and `/api/uploads/part` reads each part fully into memory with `arrayBuffer()`.
  **Recommended action:** Add strict server-side max chunk size, reject oversize parts in `/part`, and stream parts to storage instead of buffering entire chunks in RAM.

- **Issue:** File-type authorization and processing trust client-provided MIME (`mimeType`) during resumable init/finalize; this can be spoofed to route files into risky parsers (LibreOffice/ffmpeg).
  **Recommended action:** Derive/verify type server-side (magic-byte sniffing + extension policy), and gate parser selection on trusted detection rather than client MIME.

- **Issue:** Untrusted files are parsed by complex native binaries (`soffice`, `pdftoppm`, `ffmpeg`) in the app container with no explicit sandbox/isolation boundary.
  **Recommended action:** Move preview generation to an isolated worker/container (non-root, seccomp/AppArmor, read-only FS, no credentials, tight CPU/mem/pid limits).

- **Issue:** `ffmpeg` processes signed URL sources for stored media, which can still enable outbound fetch behavior for container formats/playlists and increase SSRF/exfil risk.
  **Recommended action:** Prefer local file input for preview extraction; if URL input is unavoidable, restrict ffmpeg protocols (`-protocol_whitelist file,pipe`) and block egress from preview workers.

- **Issue:** Local multipart upload path allows accumulation of session part files without strong quota enforcement, enabling disk exhaustion via many/large stale sessions.
  **Recommended action:** Enforce per-user and global disk quotas for in-progress uploads, hard-cap concurrent sessions, and perform aggressive stale cleanup on write paths.

- **Issue:** Preview generation for documents/images can process very large or adversarial payloads with limited defensive bounds, increasing decompression-bomb/CPU exhaustion risk.
  **Recommended action:** Add hard limits on decoded dimensions/pages/frames and conversion resource budgets before invoking `sharp`/document converters.

- **Issue:** External process failure details are logged with stderr/stdout aggregation, potentially leaking sensitive file-derived data into logs.
  **Recommended action:** Sanitize/redact parser stderr/stdout in production logs and keep detailed diagnostics behind debug-only controls.