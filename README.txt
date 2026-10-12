PLAYROOM PLUS — START HERE

LOCAL PLAY
1. Install Node.js LTS from https://nodejs.org/.
2. Double-click run.command (right-click → Open if macOS blocks it).
3. Open http://localhost:3000.

PUBLIC RELEASE
Read DEPLOY.md. The project includes render.yaml for a Node.js web service with a persistent data disk. Connect this repository to Render, review the plan/cost, and confirm deployment yourself.

ONLINE FEATURES
- Accounts and password hashes stored server-side.
- Real-time online Tic-Tac-Toe rooms with invite codes/links.
- Online leaderboard for Tic-Tac-Toe.
- Local games, themes, favourites and local records.
- /healthz health check for the hosting platform.

LIMITS TO KNOW
- Only Tic-Tac-Toe is currently multiplayer; other games are local.
- No email verification or password reset yet.
- JSON-file storage is suitable for a small friend group, not a large public service.
- Never publish data.json or secrets.

See DEPLOY.md for full release steps and security notes.
