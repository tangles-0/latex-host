# Consolidated Security Analysis: Upload + Preview Pipeline

## Scope
This report consolidates findings from four security analyses of the upload, multipart assembly, file classification, and preview-generation pipeline.

## Executive Summary
The current pipeline has multiple high-impact risks centered on trust of client-supplied metadata, insufficient upload integrity checks, memory/disk exhaustion vectors, and execution of complex native parsers in the primary trust boundary.  
Most critical issues can be reduced quickly by enforcing server-side upload invariants, moving conversion to an isolated worker boundary, and tightening resource/network controls.

## Risk Priorities

### Critical
1. **Missing end-to-end upload integrity validation**
   - Completion can succeed without strict verification of contiguous part coverage (`1..N`), expected part sizes, final assembled size, and checksum/hash match.
   - **Impact:** Corrupt/incomplete uploads accepted, integrity bypass, abuse of storage/processing paths.
   - **Action:** Enforce exact part set and per-part size checks, then validate final object size + cryptographic digest before marking complete.

2. **Untrusted file parsing in app trust boundary**
   - Native tools (`soffice`, `pdftoppm`, `ffmpeg`, image codecs) process attacker-controlled content without strong isolation.
   - **Impact:** Parser exploit blast radius includes app runtime, secrets, filesystem, and network.
   - **Action:** Move preview jobs to hardened isolated workers/containers (non-root, read-only FS, seccomp/AppArmor, minimal env, no credentials, strict CPU/mem/pid limits).

### High
3. **Client-controlled MIME/type trust for authorization and routing**
   - Processing and parser selection rely heavily on user-provided MIME/extension.
   - **Impact:** Type confusion can route files into risky parser paths.
   - **Action:** Perform server-side magic-byte/content sniffing, enforce policy on detected type, and reject mismatches.

4. **Memory exhaustion in upload and assembly paths**
   - Chunk handlers buffer full request bodies (`formData`/`arrayBuffer`), and local assembly may use full in-memory concatenation.
   - **Impact:** OOM/DoS with large or concurrent uploads.
   - **Action:** Stream chunks directly to storage, stream reassembly output, and set strict request/chunk size limits.

5. **Insufficient resource controls for conversion workloads**
   - Timeouts exist, but CPU/memory/process limits and conversion budgets are incomplete.
   - **Impact:** Decompression bombs and adversarial media/documents can cause CPU/RAM exhaustion.
   - **Action:** Add cgroup/rlimit constraints, queue concurrency caps, decoded dimension/page/frame limits, and per-job resource budgets.

### Medium
6. **Potential SSRF/exfil behavior through ffmpeg URL-based processing**
   - URL inputs can trigger outbound fetch behavior via container formats/playlists.
   - **Impact:** Network egress abuse and data exfiltration risk.
   - **Action:** Prefer local file inputs; if URL input is unavoidable, restrict protocols and block worker egress.

7. **Disk exhaustion via stale multipart session artifacts**
   - Local multipart parts can accumulate without strong per-user/global quotas and aggressive cleanup.
   - **Impact:** Storage exhaustion and service degradation.
   - **Action:** Enforce quotas, cap concurrent sessions, and run cleanup on write paths plus scheduled sweeps.

8. **Overexposed error logging from external tools**
   - Raw stderr/stdout and internal paths may be logged.
   - **Impact:** Sensitive data leakage and attacker-controlled log content.
   - **Action:** Sanitize/redact production logs, bound log sizes, and keep detailed diagnostics behind protected debug controls.

9. **Response-hardening gaps for shared files**
   - Permissive CORS and missing headers like `X-Content-Type-Options: nosniff` increase browser-side risk.
   - **Impact:** Content sniffing and unsafe cross-origin serving patterns for active formats.
   - **Action:** Restrict CORS by resource class and add defensive response headers.

10. **Weak extension normalization**
    - Extension extraction/normalization may allow unsafe values to flow into keys/paths.
    - **Impact:** Path/key manipulation edge cases and policy bypass opportunities.
    - **Action:** Constrain extensions to strict allowlisted regex and normalize/reject all others.

11. **Non-durable rate limiting**
    - In-memory limiter is bypassable across restarts/multi-instance deployments.
    - **Impact:** Reduced abuse resistance at scale.
    - **Action:** Move throttling/quotas to shared durable infrastructure (e.g., Redis).

## Consolidated Remediation Plan

### Phase 1 (Immediate, 1-2 weeks)
- Enforce multipart invariants at completion: exact parts, expected sizes, final size, checksum/hash.
- Add server-side hard caps on request and chunk sizes.
- Replace in-memory concat and chunk buffering with streaming paths.
- Sanitize external tool logs and add strict log-size bounds.

### Phase 2 (Near-term, 2-4 weeks)
- Deploy isolated preview worker/container with least privilege and no default egress.
- Introduce server-side file type detection (magic-byte + policy) and reject mismatches.
- Add conversion guardrails: decoded dimensions/pages/frames and queue concurrency budgets.
- Tighten CORS and add `X-Content-Type-Options: nosniff` on shared file responses.

### Phase 3 (Hardening, 4-8 weeks)
- Add per-user/global upload quotas and stale-session lifecycle enforcement.
- Restrict `ffmpeg` protocols and prefer local-file-only conversion inputs.
- Replace in-memory rate limiting with shared durable rate-limit backend.
- Add regression/security tests for all invariants and abuse scenarios.

## Security Test Checklist
- Multipart completion fails when any part is missing, duplicated, out of range, or wrong size.
- Completion fails on final size mismatch and checksum/hash mismatch.
- Oversized chunk/request is rejected before significant memory growth.
- Large multipart upload does not scale linearly in RAM during ingest/assembly.
- MIME/extension spoofing is rejected based on server-side detection.
- Preview workers run without secrets/network and respect CPU/memory limits.
- Parser error logs are redacted and bounded in production.
- Stale sessions are reclaimed and quotas prevent disk exhaustion.

## Conclusion
The most important structural change is to treat upload metadata and file type as untrusted until server-verified, and to process untrusted files only inside hardened isolation boundaries. Combined with streaming and quota controls, these changes materially reduce both exploitability and denial-of-service risk.
