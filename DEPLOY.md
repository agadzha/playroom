# Publish Playroom and share it with friends

Playroom is a Node.js, Express, and Socket.IO web app. The web page and online Tic-Tac-Toe server run together as one web service. A static-only host is not sufficient.

## Repository

The source lives at https://github.com/agadzha/playroom. The large game page is Brotli-compressed and split into text parts in `public/page-data`; `server.js` joins and decompresses it at request time. Do not delete or reorder these part files.

## Current Render deployment

The initial deployment is configured for Render's **Free** web-service plan in Frankfurt. The included `render.yaml` matches that configuration and does not provision paid storage.

Free instances have an ephemeral filesystem. Account records and match statistics are stored in `data.json`, so they can be lost when the service restarts, sleeps, or redeploys. The free service can also sleep after inactivity, leading to a cold start. These restrictions make it suitable for testing with friends, not reliable long-term accounts.

For reliable persistent account storage, the next upgrade should be a managed database with code changes to use it. Alternatively, Render persistent disks require a paid web service. Review current costs in your Render account before upgrading; don't assume any upgrade is free.

## Test the deployed site

1. Open the service's HTTPS URL from the Render Dashboard.
2. Check `/healthz`; it should return JSON with `"ok": true`.
3. Register two throwaway test accounts in separate browsers/devices.
4. From one account, create an online Tic-Tac-Toe room. Copy its invitation link and open it on the other device/account.
5. Play a game, test a rematch, leave the room and check that the opponent can join a new room.

## Share the link

Send friends the public HTTPS URL shown in the Render Dashboard. For multiplayer Tic-Tac-Toe, create a room from the Online tab and share the invitation link. Both people must use the same deployed site.

## Security and current limitations

- Never commit `data.json`, `.env`, secrets, or `node_modules`. The `.gitignore` file excludes local data and secrets.
- Use a unique password. There is no email verification or password reset.
- Only Tic-Tac-Toe currently supports multiplayer. All other games are local to each browser.
- Account storage is a JSON file, not a production database. It is acceptable only for a small test group.
- For a public launch, implement durable storage, account recovery/deletion, abuse reporting, monitoring and automated integration tests.

## Run locally on macOS

1. Install Node.js LTS from https://nodejs.org/.
2. Double-click `run.command`. If macOS blocks it, right-click and choose Open.
3. Open http://localhost:3000. Keep the terminal open while playing.
