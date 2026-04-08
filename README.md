# TradeMusic

Secure peer-to-peer track trading. No accounts, no login — just a link.

**Live:** [trademusic.app](https://trademusic.app)

## How it works

1. Create a room and share the invite link
2. Both sides upload tracks
3. App analyzes everything — spectrogram, BPM, waveform, bitrate, dynamic range, frequency cutoff
4. Preview 30 seconds of the other party's track before committing
5. Both have to approve or nobody gets anything
6. Tracks unlock at the same time
7. 24 hours to download

## Security

### Why not client-side encryption?

TradeMusic analyzes every uploaded track server-side — spectrogram, BPM, waveform, frequency cutoff, dynamic range, and a 30-second preview snippet. This analysis is what makes trades safe: you can verify what you're getting before you approve.

For this to work, the server needs temporary access to the plaintext audio. Once analysis is complete, the plaintext is deleted and only the encrypted file remains. After download, even the encryption key is destroyed — the file becomes permanently unreadable.

True client-side encryption would mean no server-side analysis, no spectrogram, no preview. The tradeoff is intentional: full verification before the trade, encryption everywhere else.

### Trust model

This is a **trusted-server** model, not a zero-knowledge system. The server processes plaintext audio during analysis — this is required for spectrogram generation, BPM detection, and preview creation. A server operator with database and KEK access could theoretically decrypt tracks between upload and download.

What limits this:
- **Per-file keys (DEK)** — each track has its own encryption key, no master "open everything" button
- **DEK destruction** — the per-file key is permanently deleted after download. Even with full server access, the track cannot be decrypted after this point
- **24-hour auto-delete** — all room data, encrypted files, and analysis artifacts are purged after expiry
- **No persistent plaintext** — decrypted audio exists only in memory during analysis, written to a temp file that is deleted in a `finally` block regardless of success or failure
- **Open source** — the full codebase is here for anyone to audit

This is the same trust model as any platform that processes your files (WeTransfer, Google Drive, Dropbox). The difference is that TradeMusic deletes the keys after delivery.

### What's in place

- **AES-256-GCM encryption** — files encrypted at rest with per-file keys
- **Content hash binding** — SHA-256 hash locks each track at upload, verified on download. All preview artifacts (spectrogram, waveform, snippet) are generated from that exact file
- **One-time download** — download links are single-use with HMAC-signed tokens. Keys are destroyed after download
- **Mutual approval** — neither party gets anything until both approve
- **No accounts** — identity is room-scoped via cryptographic secrets stored in your browser
- **Auto-delete** — rooms and all data are permanently deleted after 24 hours

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · React Query v5 · Zustand · PostgreSQL · pg-boss · Socket.io · tusd · Caddy · Docker

## Self-hosting

See [DEPLOY.md](./DEPLOY.md) for setup instructions. Runs on a single VPS with Docker Compose.

```bash
cp .env.example .env
# fill in secrets (see DEPLOY.md)
docker compose up -d --build
```

## Architecture

```
src/
  app/                    # Next.js App Router — routing & composition
  features/               # Feature modules (room, upload, admin)
  lib/                    # Shared utilities (crypto, encryption, rate-limit)
  server/                 # Server-only (DB, analysis pipeline, repositories)
  types/                  # Shared TypeScript types
  stores/                 # Zustand stores
  components/             # UI components (shadcn/ui)
```

Key design decisions:
- **Server Components first** — pages are server components, interactivity pushed to children
- **Server Actions** — default mutation entry point
- **Feature modules** — each feature owns its types, actions, queries, hooks, and components
- **Envelope encryption** — master KEK wraps per-file DEKs, DEKs destroyed after download

## Local development

```bash
# Start Postgres and tusd
docker run --rm -d --name ts-postgres -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tradesync \
  postgres:17-alpine

mkdir -p data/uploads data/artifacts

docker run --rm -d --name ts-tusd -p 8080:8080 \
  -v "$(pwd)/data/uploads:/data/uploads" \
  tusproject/tusd:v2 \
  -host=0.0.0.0 -port=8080 -base-path=/uploads/ -upload-dir=/data/uploads \
  -hooks-http=http://host.docker.internal:3000/api/webhooks/tusd \
  -hooks-enabled-events=pre-create,post-finish,post-terminate \
  -max-size=157286400

# Install deps + push schema
pnpm install
pnpm db:push

# Start everything
pnpm dev:all
```

## License

MIT
