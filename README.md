# Playroom Plus

A browser game collection with account support and real-time online Tic-Tac-Toe.

## Run locally

1. Install Node.js LTS.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Deploy

See [DEPLOY.md](DEPLOY.md). The included `render.yaml` configures a free Render Node web service with a health check. Free services do not provide a persistent filesystem; account records may be lost when the service restarts, sleeps, or redeploys. Reliable persistent accounts need a database or a paid service with persistent storage.

## Current limitations

- Only Tic-Tac-Toe currently supports multiplayer; other games are local.
- No email verification or password reset yet.
- JSON file storage is intended for small-scale testing, not a large public launch.
- Never commit `data.json`, `.env`, or secrets.
