# Playroom Plus

A browser game collection with account support and real-time online Tic-Tac-Toe.

## Run locally

1. Install Node.js LTS.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Deploy

See [DEPLOY.md](DEPLOY.md). The included `render.yaml` configures a Render Node web service with persistent storage. Review the service plan and any displayed costs before confirming deployment.

## Current limitations

- Only Tic-Tac-Toe currently supports multiplayer; other games are local.
- No email verification or password reset yet.
- JSON file storage is intended for a small group, not a large public launch.
- Never commit `data.json`, `.env`, or secrets.
