import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import cors from 'cors';
import express from 'express';
import { KNOWN_GAME_TYPES } from './games/index.js';
import { RoomManager } from './RoomManager.js';
import { getDeckCatalogMeta } from './gameDecks/index.js';

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

console.log(`Registered games: ${KNOWN_GAME_TYPES.join(', ')}`);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** Метаданные колод для экрана выбора (без текстов items) — см. src/gameDecks/bundled/ */
app.get('/api/game-decks', (_req, res) => {
  try {
    res.json(getDeckCatalogMeta());
  } catch (e) {
    res.status(500).json({
      error: String(e?.message ?? e ?? 'game-decks failed'),
    });
  }
});

io.on('connection', (socket) => {
  /** Каталог колод без отдельного HTTP /api (на некоторых хостингах проксируют только /socket.io). */
  socket.on('get_game_decks', (cb) => {
    if (typeof cb !== 'function') return;
    try {
      cb({ ok: true, catalog: getDeckCatalogMeta() });
    } catch (e) {
      cb({ ok: false, error: String(e?.message ?? e) });
    }
  });

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
          socket.emit('room_update', rooms.snapshotForClients(r.room));
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
        { name: creatorName, avatar: payload.avatar }
      );
      socket.data.hostRoomCode = code;
      socket.emit('room_created', {
        code,
        role: 'player',
        playerId,
        sessionToken: st,
        isCreator: true,
      });
      socket.emit('room_update', rooms.snapshotForClients(rooms.getRoom(code)));
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
    socket.emit('room_update', rooms.snapshotForClients(room));
    rooms.pushGameStateToSocket(room, socket.id);
  });

  socket.on('join_room', (payload = {}) => {
    const code = String(payload.code ?? '');
    const result = rooms.joinRoom(code, {
      name: payload.name,
      avatar: payload.avatar,
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
      rooms.snapshotForClients(result.room)
    );
    rooms.pushGameStateToSocket(result.room, socket.id);
  });

  socket.on('start_game', (payload = {}) => {
    const code = String(payload.code ?? '');
    const rawGt = payload.gameType;
    const gameType =
      rawGt == null || rawGt === ''
        ? 'common_guess'
        : String(rawGt).trim();
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
    const roomPayload = rooms.snapshotForClients(r.room);
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

httpServer.once('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `[gamebase] Порт ${PORT} уже занят (запущен другой процесс Node или старый сервер).\n` +
        `  Освободите порт: найдите PID командой «lsof -i :${PORT}» или «kill $(lsof -t -i:${PORT})»,\n` +
        `  либо запустите с другим портом: PORT=3002 npm start`
    );
  } else {
    console.error('[gamebase] Ошибка HTTP-сервера:', err);
  }
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`gamebase backend http://localhost:${PORT}`);
});
