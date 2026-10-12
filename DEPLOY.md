# Publish Playroom and share it with friends

Playroom is a Node.js, Express, and Socket.IO web app. The page and online Tic-Tac-Toe server run together as one web service; a static-only host is not sufficient.

## Repository

The source lives at https://github.com/agadzha/playroom. The large game page is Brotli-compressed and split into text parts in `public/page-data`; `server.js` joins and decompresses them at request time. Do not delete or reorder these part files.

## Current Render deployment

The service is configured for Render's **Free** web-service plan in Frankfurt. The included `render.yaml` matches that configuration and does not provision paid storage.

Free instances may sleep after inactivity. Online rooms are held in server memory, so they end if the service restarts, sleeps, or redeploys. This project has no registration, user accounts, passwords, saved server-side player data, or online leaderboard.

## Test the deployed site

1. Open the service's HTTPS URL from the Render Dashboard.
2. Check `/healthz`; it should return JSON with `"ok": true` and `"gameCount": 17`.
3. Open the site in two different browsers/devices.
4. In the first browser, select Online, enter a guest name and create a Tic-Tac-Toe room.
5. Open the invitation link in the second browser, enter a different guest name and join the room.
6. Play a game, try a rematch, then leave the room.

## Share the link

Send friends the public HTTPS URL shown in the Render Dashboard. For multiplayer Tic-Tac-Toe, create a room in the Online dialog and share the invitation link. Both people must use the same deployed site.

## Security and current limitations

- Never commit `.env`, secrets, or `node_modules`; the `.gitignore` file excludes local secrets.
- Only Tic-Tac-Toe currently supports online multiplayer. All other games run locally in each browser.
- Guest names appear to the other person in a room; do not use your full legal name or sensitive information.
- This is a small experimental project. For a broader public launch, add room abuse controls, monitoring and automated end-to-end tests.

## Run locally on macOS

1. Install Node.js LTS from https://nodejs.org/.
2. Double-click `run.command`. If macOS blocks it, right-click and choose Open.
3. Open http://localhost:3000. Keep the terminal open while playing.
