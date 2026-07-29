# PGP messaging TUI — requirements

Requirements for a future **Go TUI** client that connects to latex-host, fetches encrypted messages, and decrypts them locally with the user’s secret key. Private keys must never be uploaded to the app or entered in the browser.

Related web feature (already shipped): Account PGP claim flow, Messages inbox (ciphertext + threads), compose/reply encrypt-in-browser.

---

## Goals

1. Let a logged-in user read decrypted message plaintext on a trusted machine.
2. Keep the secret key **only** on that machine (file path configured by the user).
3. Authenticate the TUI via a **browser-approved device login** (user logs into latex-host in a browser and approves the device).
4. Reuse the existing messaging model: ciphertext at rest, addressing by PGP fingerprint, pairwise sender hashes, read state, mutes.

Non-goals for v1 of the TUI:

- Storing private keys in the browser or app database
- Signal-grade anonymity / metadata hiding from the server operator
- Full account deletion
- Keyserver / web-of-trust integration

---

## Threat model (TUI-specific)

| Risk | Requirement |
|------|-------------|
| Stolen API token | Short-lived access tokens; hashed refresh tokens at rest; revoke from web Account UI; scoped permissions |
| Token theft → ciphertext harvest | Acceptable residual risk; tokens must not allow reading other users’ mail; no plaintext on server |
| Secret key leave the machine | Forbidden — key file read only by local Go process; never sent over the API |
| Wrong key / wrong recipient | Encrypt/decrypt failures surfaced clearly; do not silently fall back |
| Compelled server / DB dump | Operator sees metadata (who→fingerprint, when, size) and ciphertext only |
| Static PGP keys | No forward secrecy; document that secret-key compromise can decrypt past ciphertext already downloaded |

---

## Authentication: browser device approval

### Flow

1. TUI starts a device login: `POST /api/device/code` (or equivalent) → returns `device_code`, `user_code`, poll interval, expiry, verification URL.
2. TUI displays `user_code` and URL (or opens browser).
3. User signs into latex-host in a browser (existing NextAuth session) and opens an approve page (e.g. `/account/devices` or `/device/approve`).
4. User confirms the code → server binds the pending device to `userId`.
5. TUI polls until approved → receives **access token** + **refresh token** (or single long-lived token with rotation — prefer access + refresh).
6. TUI stores tokens in a local config/secret store (file with restrictive permissions, or OS keychain if available).
7. User can **revoke** devices from the web Account UI.

### Token rules

- Store only **hashes** of refresh tokens (or device secrets) in Postgres.
- Access token: short TTL (e.g. 15–60 minutes), Bearer auth on messaging APIs.
- Refresh token: longer TTL, rotatable, revocable.
- Scopes (minimum): `messages:read`; optionally `messages:send`, `pgp:read` for reply keys.
- CSRF / trusted-origin checks on browser approve endpoints (same pattern as existing `hasTrustedOrigin`).
- Rate-limit device code creation, polling, and approve attempts.

### Out of scope for cookies

The TUI must **not** rely on NextAuth session cookies. Machine clients use Bearer tokens issued after device approval.

---

## Local configuration

User-configurable (e.g. config file or flags):

| Setting | Description |
|---------|-------------|
| `base_url` | latex-host origin (e.g. `https://latex.gg`) |
| `secret_key_file` | Path to OpenPGP secret key (armored or binary keyring) |
| `passphrase` | Optional; prompt interactively preferred over storing in plain text |
| `token_store` | Path for access/refresh tokens (default under `~/.config/latex-host-tui/` or similar) |

Requirements:

- Refuse to run decrypt commands if `secret_key_file` is missing/unreadable.
- Never transmit passphrase or secret key material to the API.
- Support standard OpenPGP secret keys usable with decryption of messages produced by OpenPGP.js / gpg (web compose).

---

## API surface the TUI needs

### Messaging APIs (session cookie **or** Bearer access token)

These exist for the web app and accept `Authorization: Bearer <access_token>` (scopes enforced) as well as browser sessions:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/messages` | Thread list (`senderHash`, unread counts, muted) |
| `GET` | `/api/messages/threads/:senderHash` | Messages in a thread (metadata; not mark-read by itself) |
| `GET` | `/api/messages/:id` | Ciphertext + mark read when contents fetched |
| `POST` | `/api/messages` | Send ciphertext (`recipientFingerprint`, `ciphertext`) |
| `POST` | `/api/messages/mute` | Mute/unmute by `senderHash` |
| `GET` | `/api/messages/threads/:senderHash/reply-key` | Sender’s registered public key for reply |
| `GET` | `/api/pgp/keys/:fingerprint` | Lookup registered public key for encrypt-to |
| `GET` | `/api/account/pgp-key` | Own key status (optional for TUI status bar) |

### Device auth APIs (implemented)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/device/code` | Start device flow (`device_name` optional) |
| `POST` | `/api/device/poll` | Poll with `device_code`; returns tokens when approved |
| `POST` | `/api/device/approve` | Browser session approves `user_code` |
| `POST` | `/api/device/token` | Refresh (`grant_type=refresh_token`) |
| `GET` | `/api/account/devices` | List devices (browser session) |
| `DELETE` | `/api/account/devices/:id` | Revoke (browser session) |

Approve UI: Account page (`/account?device_code=ABCD-EFGH`).

### Payload rules (unchanged)

- Message bodies on the wire to the server are **armored OpenPGP encrypted messages only**.
- Addressing is by **normalized 40-hex fingerprint**.
- Inbox visibility only if the user has a **claimed** PGP key.
- Clients never receive other users’ `userId`, email, or username — only `senderHash` labels.

---

## TUI functional requirements

### Must have (v1)

1. **Login** — device-code flow as above; persist tokens; refresh when expired.
2. **Inbox / threads** — list conversations as `Sender: <hash>` with unread counts.
3. **Open message** — fetch ciphertext, decrypt with local secret key, render plaintext (markdown preferred).
4. **Mark read** — opening/decrypting a message uses the existing “fetch message ⇒ mark read” behavior.
5. **Reply** — load reply-key for thread, encrypt locally, `POST /api/messages`.
6. **Compose** — paste/load recipient public key (or fingerprint lookup if registered), encrypt locally, send.
7. **Mute / unmute** — by `senderHash`.
8. **Logout / revoke local tokens** — clear local store; optional call to revoke endpoint.
9. **Clear errors** — bad passphrase, wrong key, unregistered recipient, unclaimed inbox, network/auth failures.

### Nice to have (later)

- Watch/poll for new messages
- Sent folder / outbound history
- Offline cache of ciphertext (encrypted at rest optional)
- Assist Account PoP: decrypt verify challenge and print/submit code
- Multiple identities / keyrings

---

## Crypto requirements

- Library: Go OpenPGP stack compatible with messages from web OpenPGP.js compose (document tested versions).
- Decrypt: secret key from `secret_key_file` (+ passphrase prompt).
- Encrypt: recipient public key from reply-key API, pubkey paste, or `/api/pgp/keys/:fingerprint`.
- Do not send plaintext markdown/body to the API.
- Validate ciphertext is encrypted OpenPGP before upload (same spirit as server `assertEncryptedOpenPgpMessage`).
- Size limits should match server (`~128 KiB` plaintext / `~256 KiB` ciphertext — see `src/lib/pgp-limits.ts`).

---

## UX sketch (TUI)

Suggested screens/modes:

1. **Login** — show user code + URL; wait until approved.
2. **Threads** — list `Sender: <hash>`, unread badge, last activity.
3. **Thread** — message list; open one → decrypt view (markdown).
4. **Compose / Reply** — editor; status line with fingerprint; send.
5. **Settings** — base URL, key path, revoke/logout.

Keyboard-driven navigation; no secret key contents printed to scrollback.

---

## Web Account additions (supporting the TUI)

- Device approve UI (enter/confirm user code while logged in).
- List + revoke devices.
- Short copy linking to TUI install/config docs.
- Danger zone already deletes claimed key + messages + sender hashes; revoked devices should be independent of key delete (revoking key does not have to revoke devices, but document behavior).

---

## Privacy notes for users (document in TUI `--help` / README)

- The server never sees message plaintext or your private key.
- The server **does** see that your account messaged a fingerprint, when, and approximate size.
- Public keys may contain User ID packets (name/email).
- Pairwise sender hashes are per-recipient; they are not global identities.
- Compromising your long-term secret key can expose previously downloaded ciphertext.

---

## Implementation notes for latex-host

When building the device API:

- Follow patterns in `src/lib/password-reset.ts` (hashed secrets, TTL) and `src/lib/request-security.ts` (trusted origin on approve).
- Accept `Authorization: Bearer <access_token>` on messaging routes in addition to `getSessionUserId()` session auth.
- Keep rate limits on send/poll/approve.
- Do not log tokens, passphrases, plaintext, or private keys.

---

## Acceptance criteria

- [x] User can approve a TUI device from a browser session without sharing password with the TUI binary beyond normal login in the browser. *(server + Account UI done; Go TUI client still to build)*
- [ ] TUI can list threads and decrypt messages using only a local secret key file. *(API ready; Go client pending)*
- [x] Private key never appears in HTTP requests, server logs, or the database.
- [x] Reply in an existing thread works without re-pasting the peer’s public key (via reply-key API), provided they have a registered key.
- [x] User can revoke the device from the web UI and the TUI loses API access on next refresh/use.
- [x] Unclaimed PGP key accounts still cannot see inbox contents (same as web).
