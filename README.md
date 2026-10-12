# Playroom

A browser game collection with 17 games. No registration, accounts, or passwords are required.

## Run locally

1. Install Node.js LTS.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Online play

Only Tic-Tac-Toe currently supports real-time online matches. Pick a guest name, create a room, then share the room code or invitation link. No account or password is needed. Other games run locally in the browser.

Online rooms are temporary and live in server memory; a server restart or sleep may end an active room. Game records, favorites, theme, and guest nickname are stored locally in the browser. No player accounts or leaderboard are maintained.

## Deploy

The included `render.yaml` configures a Render Node web service. On the free Render plan, the service may sleep after inactivity, and active online rooms can be cleared on restart.

Never commit `.env`, secrets, or private data.