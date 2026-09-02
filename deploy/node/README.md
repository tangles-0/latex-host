# latex.gg self-hosted node

This Compose stack runs the latex gallery, PostgreSQL, and the preview worker on
your server. Files, thumbnails, notes, albums, shares, and database records stay
on that server. `latex.gg/share/<node>/<share>` checks node status and redirects
file bytes to your public node.

Viewers can see your node hostname and IP address. latex.gg does not proxy media.

## Requirements

- Docker Engine with Compose v2
- A public HTTPS origin that reverse-proxies to the configured `PORT`
- Public DNS that resolves to this server
- A latex.gg account

The stack does not include Caddy or another TLS proxy. HTTP public node URLs
cannot be linked because browsers would block redirects from HTTPS as mixed
content.

## Install

1. Copy `compose.yaml` and `.env.example` into an empty directory.
2. Rename `.env.example` to `.env`.
3. Set only:

   ```dotenv
   PORT=3000
   STORAGE_PATH=/srv/latex-node
   ```

4. Create the storage directory and make it writable by `PUID`/`PGID` (1001 by
   default):

   ```bash
   sudo install -d -o 1001 -g 1001 /srv/latex-node
   ```

5. Start the node:

   ```bash
   docker compose up -d
   ```

6. Reverse-proxy your HTTPS hostname to `http://127.0.0.1:3000`. Set
   `NEXTAUTH_URL=https://your-node.example` in `.env`, using that exact public
   origin, then run `docker compose up -d` again.
7. Open `http://<server-ip>:3000` locally, or the configured HTTPS hostname.
8. On latex.gg, open **Account → Add self-hosted node**. Copy the one-time code
   into the node setup page with the public HTTPS URL.

After linking, management login is delegated to latex.gg. The node never asks
for or receives your latex.gg password.

## Storage behavior

The entire `STORAGE_PATH` is treated as a source-only browse root. The app needs
the mount to be writable so it can create `.latex` and hardlinks, but import and
gallery deletion never modify source files. Imported files are hardlinked into
`STORAGE_PATH/.latex/uploads` when possible and copied otherwise. Public routes
only serve managed files under `.latex`; they never serve arbitrary browse-root
paths.

Removing an item from the gallery removes the managed link/copy and database
record. It does not delete the original browse-root file.

Symlinks are hidden and rejected. Imports are queued, capped at 100,000 files
per job, and feed the preview worker through its durable queue.
Sensitive names such as `.ssh`, `.gnupg`, `.aws`, and `.env` are hidden by
default. Override `NODE_BROWSE_IGNORE_NAMES` only if you understand the risk.

## Update

Images use `latest` by default. Update manually:

```bash
docker compose pull
docker compose up -d
```

For predictable rollouts, set `LATEX_NODE_IMAGE` and `LATEX_PREVIEW_IMAGE` to
matching version tags. Automatic update tools such as Watchtower are optional
and intentionally not enabled. Versioned node images also show an update notice
on the home page when a newer `node-v*` release is available.

The app synchronizes its Drizzle schema before every start. A failed schema
update stops the app instead of serving against an incompatible database.

## Backup

Back up both:

- `STORAGE_PATH` (especially `.latex`)
- the `postgres_data` Docker volume

The storage directory alone does not contain album/share metadata. Test a
restore before relying on a backup.

## Troubleshooting

```bash
docker compose ps
docker compose logs -f app preview db
```

If the app cannot write imported files, make `STORAGE_PATH` writable by
`PUID`/`PGID`. If latex.gg reports “not reachable,” verify public DNS, the TLS
certificate, reverse-proxy routing, and that `/api/node/health` reaches the app.
