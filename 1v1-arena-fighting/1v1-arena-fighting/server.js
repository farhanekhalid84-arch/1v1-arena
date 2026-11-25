const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

const rooms = new Map();
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function publicRoom(room) {
  return {
    code: room.code,
    players: Object.values(room.players).map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y, facing: p.facing,
      hp: p.hp, energy: p.energy, action: p.action, actionUntil: p.actionUntil,
      wins: p.wins, ready: p.ready
    })),
    round: room.round,
    status: room.status,
    message: room.message
  };
}
function broadcast(room) {
  io.to(room.code).emit("state", publicRoom(room));
}
function makePlayer(id, name, slot) {
  return {
    id, name: String(name || "Fighter").slice(0, 16),
    x: slot === 0 ? 260 : 740, y: 0, facing: slot === 0 ? 1 : -1,
    hp: 100, energy: 0, action: "idle", actionUntil: 0,
    wins: 0, ready: false, lastAttack: 0, lastSpecial: 0, lastHit: 0
  };
}
function resetRound(room) {
  const ps = Object.values(room.players);
  ps.forEach((p, i) => {
    p.x = i === 0 ? 260 : 740; p.y = 0; p.hp = 100; p.energy = 0;
    p.action = "idle"; p.actionUntil = 0; p.ready = false;
  });
  room.status = "waiting";
  room.message = "Ready up to start the next round";
  room.round += 1;
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name }, cb = () => {}) => {
    let code;
    do { code = Math.random().toString(36).slice(2, 7).toUpperCase(); } while (rooms.has(code));
    const room = { code, players: {}, round: 1, status: "waiting", message: "Waiting for opponent" };
    room.players[socket.id] = makePlayer(socket.id, name, 0);
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    cb({ ok: true, code, playerId: socket.id });
    broadcast(room);
  });

  socket.on("joinRoom", ({ code, name }, cb = () => {}) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, error: "Room not found. Check the code." });
    if (Object.keys(room.players).length >= 2) return cb({ ok: false, error: "This room is full." });
    if (room.players[socket.id]) return cb({ ok: true, code, playerId: socket.id });
    room.players[socket.id] = makePlayer(socket.id, name, 1);
    socket.join(code);
    socket.data.room = code;
    room.message = "Both fighters connected — ready up!";
    cb({ ok: true, code, playerId: socket.id });
    broadcast(room);
  });

  socket.on("ready", () => {
    const room = rooms.get(socket.data.room);
    if (!room || Object.keys(room.players).length !== 2) return;
    const p = room.players[socket.id];
    if (!p) return;
    p.ready = true;
    if (Object.values(room.players).every(x => x.ready)) {
      room.status = "playing";
      room.message = "FIGHT!";
    }
    broadcast(room);
  });

  socket.on("input", input => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "playing") return;
    const p = room.players[socket.id];
    if (!p) return;
    const now = Date.now();
    const other = Object.values(room.players).find(x => x.id !== socket.id);
    if (!other) return;

    const keys = input || {};
    if (keys.left) p.x -= 5;
    if (keys.right) p.x += 5;
    if (keys.jump && p.y === 0) p.y = 1;
    if (p.y > 0) p.y = Math.min(95, p.y + 13);
    else if (p.y < 0) p.y = 0;
    if (p.y >= 95) p.y = -1;
    if (p.y === -1) p.y = 0;
    p.x = clamp(p.x, 90, 910);
    p.facing = other.x >= p.x ? 1 : -1;

    if (keys.block) p.action = "block";
    else if (p.action === "block") p.action = "idle";

    if (keys.attack && now - p.lastAttack > 520) {
      p.lastAttack = now; p.action = "punch"; p.actionUntil = now + 230;
      const close = Math.abs(other.x - p.x) < 125 && Math.abs(other.y - p.y) < 70;
      if (close && now - other.lastHit > 350 && other.action !== "block") {
        other.hp = Math.max(0, other.hp - 9); other.lastHit = now;
        p.energy = Math.min(100, p.energy + 14);
      } else if (close && other.action === "block") {
        p.energy = Math.min(100, p.energy + 4);
      }
    }
    if (keys.kick && now - p.lastAttack > 650) {
      p.lastAttack = now; p.action = "kick"; p.actionUntil = now + 300;
      const close = Math.abs(other.x - p.x) < 150 && Math.abs(other.y - p.y) < 75;
      if (close && now - other.lastHit > 350 && other.action !== "block") {
        other.hp = Math.max(0, other.hp - 13); other.lastHit = now;
        p.energy = Math.min(100, p.energy + 18);
      }
    }
    if (keys.special && p.energy >= 50 && now - p.lastSpecial > 1800) {
      p.lastSpecial = now; p.energy -= 50; p.action = "special"; p.actionUntil = now + 420;
      if (Math.abs(other.x - p.x) < 270 && Math.abs(other.y - p.y) < 100 && other.action !== "block") {
        other.hp = Math.max(0, other.hp - 22); other.lastHit = now;
      }
    }

    if (p.actionUntil && now > p.actionUntil && !keys.block) {
      p.action = "idle"; p.actionUntil = 0;
    }

    if (other.hp <= 0 && room.status === "playing") {
      p.wins += 1;
      room.status = "roundover";
      room.message = `${p.name} wins the round!`;
      setTimeout(() => {
        if (!rooms.has(room.code)) return;
        const current = rooms.get(room.code);
        if (Object.keys(current.players).length === 2) resetRound(current);
        broadcast(current);
      }, 2600);
    }
    broadcast(room);
  });

  socket.on("disconnect", () => {
    const code = socket.data.room;
    const room = rooms.get(code);
    if (!room) return;
    delete room.players[socket.id];
    if (Object.keys(room.players).length === 0) rooms.delete(code);
    else {
      room.status = "waiting";
      room.message = "Opponent disconnected";
      broadcast(room);
    }
  });
});

server.listen(PORT, () => console.log(`1V1 ARENA running on ${PORT}`));