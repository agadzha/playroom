PLAYROOM PLUS — START HERE

LOCAL PLAY
1. Install Node.js LTS from https://nodejs.org/.
2. Double-click run.command (right-click → Open if macOS blocks it).
3. Open http://localhost:3000.

PUBLIC RELEASE
The repository is connected to Render's Free web-service plan. See DEPLOY.md.
The free service filesystem is temporary, so account data can be lost on restarts,
sleep or redeploy. Persistent long-term accounts require a database or paid storage.

ONLINE FEATURES
- Accounts stored server-side (passwords are stored as cryptographic hashes).
- Real-time online Tic-Tac-Toe rooms with invite codes/links.
- Online leaderboard for Tic-Tac-Toe.
- Local games, themes, favourites and local records.
- /healthz health check for the hosting platform.

LIMITS TO KNOW
- Only Tic-Tac-Toe is currently multiplayer; other games are local.
- No email verification or password reset yet.
- Never publish data.json or secrets.

See DEPLOY.md for more details.
