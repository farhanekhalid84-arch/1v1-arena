# 1V1 ARENA — 2D Online Fighting

A small real-time, two-player browser fighting game. Players create or join a private room with a five-character code.

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in this project folder.
3. Run `npm install`
4. Run `npm start`
5. Visit `http://localhost:3000`

To test with a friend on the same Wi-Fi, share your computer's local network address (for example `http://192.168.x.x:3000`) if your firewall allows incoming connections.

## Put it online (Render)

1. Create a GitHub account and a new repository.
2. Upload all files in this folder to the repository (keep `server.js`, `package.json`, `README.md`, and the `public` folder).
3. On Render, choose **New + → Web Service** and connect that repository.
4. Set **Build Command** to `npm install`.
5. Set **Start Command** to `npm start`.
6. Deploy. Render will provide a public HTTPS address. Share that address with friends.

Use a Node web-service host that supports long-lived WebSocket connections. Do not deploy this as a static-only website; the Socket.IO server is required for online multiplayer.

## Controls

Player 1: A/D move, W jump, J punch, K kick, L block, U special.
Player 2: Arrow keys move/jump, 1 punch, 2 kick, 3 block, 4 special.
On touch devices, the on-screen controls are available.

## Important prototype notes

This is a playable starter prototype, not a production-grade competitive fighting engine. It uses simple canvas-drawn fighters and server-relayed game state. Before a public launch, add server-authoritative movement and hit validation, rate limits, anti-cheat protections, account/authentication, moderation/reporting, persistent stats, and proper mobile controls.
