PLAYROOM — START HERE

LOCAL PLAY
1. Install Node.js LTS from https://nodejs.org/.
2. Double-click run.command (right-click → Open if macOS blocks it).
3. Open http://localhost:3000.

PUBLIC RELEASE
The repository is connected to Render's Free web-service plan. See DEPLOY.md.
The free service can sleep after inactivity, and active online rooms can end
when the server restarts or redeploys.

ONLINE FEATURES
- No registration, accounts or passwords.
- Real-time guest Tic-Tac-Toe rooms with invite codes/links.
- Local games, themes, favourites and personal records in the browser.
- /healthz health check for the hosting platform.

LIMITS TO KNOW
- Only Tic-Tac-Toe is currently multiplayer; other games are local.
- Online rooms and player names are temporary and are not stored as accounts.
- Never publish .env, secrets or private data.

See DEPLOY.md for more details.
