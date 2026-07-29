const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const {
  createRoom,
  addPlayer,
  removePlayer,
  startGame,
  submitBid,
  playCard,
  nextRound,
  serializeRoom
} = require("./src/game");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const socketSessions = new Map();

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size
  });
});

function generateRoomCode() {
  let code;

  do {
    code = Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}

function broadcastRoom(room) {
  for (const player of room.players) {
    io.to(player.id).emit("room:update", serializeRoom(room, player.id));
  }
}

function emitError(socket, message) {
  socket.emit("app:error", {
    message
  });
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name, settings }) => {
    try {
      const roomCode = generateRoomCode();
      const room = createRoom(roomCode, socket.id, name, settings);

      rooms.set(roomCode, room);
      socketSessions.set(socket.id, {
        roomCode,
        playerId: socket.id
      });

      socket.join(roomCode);

      socket.emit("room:created", {
        code: roomCode
      });

      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("room:join", ({ code, name }) => {
    try {
      const normalizedCode = String(code || "").trim().toUpperCase();
      const room = rooms.get(normalizedCode);

      if (!room) {
        throw new Error("Salon introuvable.");
      }

      addPlayer(room, socket.id, name);

      socketSessions.set(socket.id, {
        roomCode: normalizedCode,
        playerId: socket.id
      });

      socket.join(normalizedCode);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("game:start", () => {
    try {
      const session = socketSessions.get(socket.id);
      const room = rooms.get(session?.roomCode);

      if (!room) throw new Error("Salon introuvable.");
      if (room.hostId !== socket.id) {
        throw new Error("Seul le capitaine peut démarrer la partie.");
      }

      startGame(room);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("game:bid", ({ bid }) => {
    try {
      const session = socketSessions.get(socket.id);
      const room = rooms.get(session?.roomCode);

      if (!room) throw new Error("Salon introuvable.");

      submitBid(room, socket.id, bid);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("game:play-card", ({ cardId }) => {
    try {
      const session = socketSessions.get(socket.id);
      const room = rooms.get(session?.roomCode);

      if (!room) throw new Error("Salon introuvable.");

      playCard(room, socket.id, cardId);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("game:next-round", () => {
    try {
      const session = socketSessions.get(socket.id);
      const room = rooms.get(session?.roomCode);

      if (!room) throw new Error("Salon introuvable.");

      nextRound(room);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("disconnect", () => {
    const session = socketSessions.get(socket.id);

    if (!session) return;

    const room = rooms.get(session.roomCode);

    if (!room) return;

    const player = room.players.find((item) => item.id === socket.id);

    if (player) {
      player.connected = false;
    }

    if (room.status === "lobby") {
      removePlayer(room, socket.id);

      if (room.players.length === 0) {
        rooms.delete(session.roomCode);
      } else {
        broadcastRoom(room);
      }
    } else {
      broadcastRoom(room);
    }

    socketSessions.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});