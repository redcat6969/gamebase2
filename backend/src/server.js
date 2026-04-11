import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import cors from 'cors';
import express from 'express';
import { RoomManager } from './RoomManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const qPath = join(__dirname, '../questions.json');
  const arr = JSON.parse(readFileSync(qPath, 'utf8'));
  console.log(`Questions bank: ${Array.isArray(arr) ? arr.length : 0} items`);
} catch (e) {
  console.warn('questions.json:', e?.message ?? e);
}

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

const rooms = new RoomManager(io);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('host_create_room', (payload = {}) => {
    try {
      const sessionToken = payload.sessionToken ? String(payload.sessionToken) : null;
      if (socket.data.hostRoomCode) {
        const code = socket.data.hostRoomCode;
        const room = rooms.getRoom(code);
        if (room) {
          const r = rooms.attachHostSocket(code, socket.id, sessionToken);
          if (!r.ok) {
            socket.emit('error_msg', { code: r.error });
            return;
          }
          const creator = r.room.players.get(r.room.creatorPlayerId ?? '');
          socket.emit('room_created', {
            code,
            role: 'player',
            playerId: creator?.id,
            sessionToken: creator?.sessionToken,
            isCreator: true,
          });
          socket.emit('room_update', rooms.serializeRoom(r.room));
          rooms.pushGameStateToSocket(r.room, socket.id);
          return;
        }
        delete socket.data.hostRoomCode;
      }

      const creatorName = String(payload.creatorName ?? payload.name ?? '').trim();
      if (!creatorName) {
        socket.emit('error_msg', {
          code: 'CREATOR_NAME_REQUIRED',
          message: 'Введите имя создателя',
        });
        return;
      }

      const { code, playerId, sessionToken: st } = rooms.createRoom(
        socket.id,
        creatorName
      );
      socket.data.hostRoomCode = code;
      socket.emit('room_created', {
        code,
        role: 'player',
        playerId,
        sessionToken: st,
        isCreator: true,
      });
      socket.emit('room_update', rooms.serializeRoom(rooms.getRoom(code)));
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg === 'CREATOR_NAME_REQUIRED') {
        socket.emit('error_msg', {
          code: 'CREATOR_NAME_REQUIRED',
          message: 'Введите имя создателя',
        });
      } else {
        socket.emit('error_msg', { message: msg });
      }
    }
  });

  socket.on('host_rejoin', ({ code, sessionToken } = {}) => {
    const c = String(code ?? '').replace(/\D/g, '').slice(0, 4);
    const result = rooms.attachHostSocket(c, socket.id, sessionToken ?? null);
    if (!result.ok) {
      socket.emit('error_msg', { code: result.error });
      return;
    }
    const room = result.room;
    socket.data.hostRoomCode = c;
    const creator = room.creatorPlayerId
      ? room.players.get(room.creatorPlayerId)
      : null;
    socket.emit('room_joined', {
      code: c,
      role: 'player',
      playerId: creator?.id,
      sessionToken: creator?.sessionToken,
      isCreator: true,
    });
    socket.emit('room_update', rooms.serializeRoom(room));
    rooms.pushGameStateToSocket(room, socket.id);
  });

  socket.on('join_room', (payload = {}) => {
    const code = String(payload.code ?? '');
    const result = rooms.joinRoom(code, {
      name: payload.name,
      sessionToken: payload.sessionToken ?? null,
      socketId: socket.id,
      role: payload.role === 'spectator' ? 'spectator' : 'player',
    });
    if (!result.ok) {
      socket.emit('join_room_failed', { code: result.error });
      return;
    }
    const isSpectator = payload.role === 'spectator';
    socket.emit('room_joined', {
      code: result.room.code,
      role: isSpectator ? 'spectator' : 'player',
      playerId: result.playerId,
      sessionToken: result.sessionToken,
      isCreator: false,
    });
    io.to(`room:${result.room.code}`).emit(
      'room_update',
      rooms.serializeRoom(result.room)
    );
    rooms.pushGameStateToSocket(result.room, socket.id);
  });

  socket.on('start_game', (payload = {}) => {
    const code = String(payload.code ?? '');
    const gameType = String(payload.gameType ?? 'common_guess');
    let r;
    try {
      r = rooms.startGame(code, socket.id, gameType, payload.options ?? {});
    } catch (e) {
      socket.emit('start_game_failed', {
        code: 'START_ERROR',
        message: String(e?.message ?? e),
      });
      return;
    }
    if (!r.ok) {
      socket.emit('start_game_failed', { code: r.error });
      return;
    }
    const roomPayload = rooms.serializeRoom(r.room);
    io.to(`room:${r.room.code}`).emit('room_update', roomPayload);
    socket.emit('room_update', roomPayload);
  });

  socket.on('host_game_action', (payload = {}) => {
    const code = String(payload.code ?? '');
    const r = rooms.hostGameAction(code, socket.id, payload.action ?? {});
    if (!r.ok) {
      socket.emit('host_game_action_failed', { code: r.error });
    }
  });

  socket.on('player_action', (payload = {}) => {
    const code = String(payload.code ?? '');
    const playerId = String(payload.playerId ?? '');
    const r = rooms.playerAction(code, playerId, socket.id, payload.action ?? {});
    if (!r.ok) {
      socket.emit('player_action_failed', { code: r.error });
    }
  });

  socket.on('SUBMIT_MATCH', (payload = {}) => {
    const code = String(payload.code ?? '');
    const playerId = String(payload.playerId ?? '');
    const r = rooms.playerAction(code, playerId, socket.id, {
      type: 'submit_match',
      roundId: payload.roundId,
      matched: payload.matched,
      wordId: payload.wordId ?? null,
      wordText:
        typeof payload.wordText === 'string' ? payload.wordText : null,
    });
    if (!r.ok) {
      socket.emit('player_action_failed', { code: r.error });
    }
  });

  socket.on('disconnect', () => {
    rooms.leaveBySocket(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`gamebase backend http://localhost:${PORT}`);
});
