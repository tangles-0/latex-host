# Security review: large uploads + host binary preview pipeline

- **Issue:** File type trust is primarily based on client-controlled `mimeType` and filename extension (`extFromFileName`, `mediaKindFromType`, allowlist checks), with no magic-byte/content verification before processing/parsing.
  **Recommended action:** Add server-side MIME sniffing/signature validation (and reject mismatches) before storage and before invoking preview tooling.

- **Issue:** Upload handlers buffer whole request bodies/chunks in memory (`file.arrayBuffer()`, `chunk.arrayBuffer()`) and preview paths read entire files into buffers for processing.
  **Recommended action:** Stream uploads to disk/object storage and stream into processing pipelines; apply strict per-request memory/backpressure controls.

- **Issue:** Chunk upload path does not enforce per-part size bounds server-side in `uploadSessionPart`; attackers can send oversized chunks and inflate resource usage.
  **Recommended action:** Enforce max chunk byte size per session and reject parts exceeding expected boundaries.

- **Issue:** Local multipart completion concatenates received parts without validating contiguous part coverage or exact final size (`fileSize`), enabling incomplete/corrupted assembly and abuse patterns.
  **Recommended action:** Require full part set (1..N), validate each expected part size, and assert assembled size/hash matches declared metadata before completion.

- **Issue:** Extension extraction is unsanitized (`extFromFileName`) and later interpolated into storage keys/paths; crafted names can inject path separators into `ext`.
  **Recommended action:** Constrain extension to a strict regex allowlist (e.g., `^[a-z0-9]{1,16}$`) and normalize/reject anything else.

- **Issue:** Host binary execution (`soffice`, `pdftoppm`, `ffmpeg`) is run without sandboxing/containment beyond timeout; malicious documents/media can trigger parser-level RCE/SSRF/LPE paths.
  **Recommended action:** Run converters in a hardened isolation boundary (seccomp/apparmor/container jail, no network, low-priv user, readonly FS, constrained tmp), and keep binaries patched.

- **Issue:** Converter invocations only set timeouts; no CPU/memory/process/file-descriptor limits are applied.
  **Recommended action:** Add OS-level rlimits/cgroups and job queue concurrency caps per user/system to mitigate decompression bombs and parser abuse.

- **Issue:** Office/PDF preview and error logging can include detailed stderr/stdout and filesystem paths in logs.
  **Recommended action:** Redact/summarize process errors for user-facing and centralized logs; preserve detailed diagnostics only in protected debug channels.

- **Issue:** Text preview path can render content derived from untrusted files into generated previews/logs, raising sensitive-data exposure risk.
  **Recommended action:** Gate preview generation by policy, truncate aggressively, and add content-classification/redaction controls for sensitive uploads.

- **Issue:** In-memory rate limiting (`Map`) is per-process and easy to bypass in multi-instance deployments/restarts.
  **Recommended action:** Move rate limiting and upload abuse controls to a shared durable backend (e.g., Redis) with per-user/IP quotas.