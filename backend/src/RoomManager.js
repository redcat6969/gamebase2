import { createGame } from './games/index.js';

/** @typedef {'LOBBY' | 'PLAYING' | 'RESULTS'} RoomStatus */
/** @typedef {'player' | 'spectator'} ParticipantRole */

/**
 * @typedef {Object} PlayerRecord
 * @property {string} id
 * @property {string} name
 * @property {string} socketId
 * @property {string} sessionToken
 * @property {ParticipantRole} role
 * @property {boolean} isCreator
 * @property {number} score
 */

/**
 * @typedef {Object} Room
 * @property {string} code
 * @property {RoomStatus} status
 * @property {string | null} hostSocketId
 * @property {string | null} creatorPlayerId
 * @property {Map<string, PlayerRecord>} players
 * @property {string | null} gameType
 * @property {import('./games/BaseGame.js').BaseGame | null} game
 * @property {ReturnType<typeof setTimeout> | null} [orphanTimer]
 */

function randomDigits4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** @param {Room} room */
function countRolePlayers(room) {
  let n = 0;
  for (const p of room.players.values()) {
    if (p.role === 'player') n += 1;
  }
  return n;
}

/** @param {Room} room @returns {Map<string, PlayerRecord>} */
function playersOnlyMap(room) {
  const m = new Map();
  for (const [id, p] of room.players) {
    if (p.role === 'player') m.set(id, p);
  }
  return m;
}

export class RoomManager {
  /** @param {import('socket.io').Server} io */
  constructor(io) {
    this.io = io;
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  /**
   * @param {string} socketId
   * @param {string} creatorName
   * @returns {{ code: string, playerId: string, sessionToken: string }}
   */
  createRoom(socketId, creatorName) {
    const name = String(creatorName ?? '').trim().slice(0, 32);
    if (!name) {
      throw new Error('CREATOR_NAME_REQUIRED');
    }

    let code = randomDigits4();
    let guard = 0;
    while (this.rooms.has(code) && guard++ < 50) {
      code = randomDigits4();
    }
    if (this.rooms.has(code)) {
      throw new Error('Could not allocate room code');
    }

    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();

    /** @type {PlayerRecord} */
    const creator = {
      id,
      name,
      socketId,
      sessionToken,
      role: 'player',
      isCreator: true,
      score: 0,
    };

    /** @type {Room} */
    const room = {
      code,
      status: 'LOBBY',
      hostSocketId: socketId,
      creatorPlayerId: id,
      players: new Map([[id, creator]]),
      gameType: null,
      game: null,
      orphanTimer: null,
    };
    this.rooms.set(code, room);
    this._joinSocketRoom(socketId, code);
    return { code, playerId: id, sessionToken };
  }

  /** @param {string} code */
  getRoom(code) {
    const c = this._normalizeCode(code);
    if (!c) return null;
    return this.rooms.get(c) ?? null;
  }

  /**
   * @param {string} code
   * @param {{ name: string, sessionToken?: string | null, socketId: string, role?: string }} payload
   * @returns {{ ok: true, playerId: string, sessionToken: string, room: Room } | { ok: false, error: string }}
   */
  joinRoom(code, payload) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    if (payload.role === 'spectator') {
      const st = payload.sessionToken ? String(payload.sessionToken) : null;
      if (st) {
        for (const p of room.players.values()) {
          if (p.sessionToken === st && p.role === 'spectator') {
            for (const [pid, pl] of [...room.players]) {
              if (pl.socketId === payload.socketId && pid !== p.id) {
                room.players.delete(pid);
              }
            }
            p.socketId = payload.socketId;
            this._clearOrphanTimer(room);
            this._joinSocketRoom(payload.socketId, room.code);
            return { ok: true, playerId: p.id, sessionToken: p.sessionToken, room };
          }
        }
      }
      return this._joinSpectator(room, payload.socketId);
    }

    const name = String(payload.name ?? '').trim().slice(0, 32);
    if (!name) return { ok: false, error: 'NAME_REQUIRED' };

    const token = payload.sessionToken ? String(payload.sessionToken) : null;

    if (token) {
      for (const p of room.players.values()) {
        if (p.sessionToken === token && p.role === 'player') {
          p.socketId = payload.socketId;
          this._clearOrphanTimer(room);
          this._joinSocketRoom(payload.socketId, room.code);
          return { ok: true, playerId: p.id, sessionToken: p.sessionToken, room };
        }
      }
    }

    for (const [pid, p] of [...room.players]) {
      if (p.socketId === payload.socketId) {
        room.players.delete(pid);
      }
    }

    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();
    /** @type {PlayerRecord} */
    const player = {
      id,
      name,
      socketId: payload.socketId,
      sessionToken,
      role: 'player',
      isCreator: false,
      score: 0,
    };
    room.players.set(id, player);
    this._clearOrphanTimer(room);
    this._joinSocketRoom(payload.socketId, room.code);
    return { ok: true, playerId: id, sessionToken, room };
  }

  /**
   * @param {Room} room
   * @param {string} socketId
   */
  _joinSpectator(room, socketId) {
    for (const [pid, p] of [...room.players]) {
      if (p.socketId === socketId) {
        room.players.delete(pid);
      }
    }

    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();
    /** @type {PlayerRecord} */
    const spectator = {
      id,
      name: '',
      socketId,
      sessionToken,
      role: 'spectator',
      isCreator: false,
      score: 0,
    };
    room.players.set(id, spectator);
    this._clearOrphanTimer(room);
    this._joinSocketRoom(socketId, room.code);
    return { ok: true, playerId: id, sessionToken, room };
  }

  /**
   * @param {string} code
   * @param {string} socketId
   * @param {string | null} [sessionToken]
   */
  attachHostSocket(code, socketId, sessionToken = null) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    room.hostSocketId = socketId;
    const cid = room.creatorPlayerId;
    if (cid) {
      const creator = room.players.get(cid);
      if (creator?.isCreator && creator.role === 'player') {
        if (sessionToken && creator.sessionToken !== sessionToken) {
          return { ok: false, error: 'INVALID_CREATOR_SESSION' };
        }
        for (const [pid, p] of [...room.players]) {
          if (p.socketId === socketId && pid !== cid) {
            room.players.delete(pid);
          }
        }
        creator.socketId = socketId;
      }
    }

    this._clearOrphanTimer(room);
    this._joinSocketRoom(socketId, room.code);
    return { ok: true, room };
  }

  /** @param {string} socketId */
  leaveBySocket(socketId) {
    for (const room of this.rooms.values()) {
      let touched = false;
      if (room.hostSocketId === socketId) {
        room.hostSocketId = null;
        touched = true;
      }
      for (const [pid, p] of room.players) {
        if (p.socketId === socketId) {
          room.players.delete(pid);
          touched = true;
          break;
        }
      }
      if (!touched) continue;

      this.io.sockets.sockets.get(socketId)?.leave(this._roomChannel(room.code));
      if (room.players.size === 0 && !room.hostSocketId) {
        if (room.status === 'LOBBY') {
          this._scheduleLobbyOrphanCleanup(room);
        } else {
          this._clearOrphanTimer(room);
          this.rooms.delete(room.code);
        }
      }
      this.io
        .to(this._roomChannel(room.code))
        .emit('room_update', this.serializeRoom(room));
      return;
    }
  }

  /**
   * @param {string} code
   * @param {string} hostSocketId
   * @param {string} gameType
   * @param {Record<string, unknown>} [options]
   */
  startGame(code, hostSocketId, gameType, options = {}) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.hostSocketId !== hostSocketId) {
      return { ok: false, error: 'NOT_HOST' };
    }
    if (countRolePlayers(room) < 1) {
      return { ok: false, error: 'NEED_PLAYERS' };
    }

    room.gameType = gameType;
    room.status = 'PLAYING';

    const ctx = {
      code: room.code,
      getPlayers: () => playersOnlyMap(room),
      getParticipants: () => room.players,
      getHostSocketId: () => room.hostSocketId ?? '',
      getRoomStatus: () => room.status,
      setRoomStatus: (/** @type {RoomStatus} */ s) => {
        room.status = s;
      },
      broadcast: (event, payload) => {
        this.io.to(this._roomChannel(room.code)).emit(event, payload);
      },
      emitToSocket: (targetSocketId, event, payload) => {
        if (!targetSocketId) return;
        this.io.sockets.sockets.get(targetSocketId)?.emit(event, payload);
      },
      syncPlayerScores: (/** @type {Map<string, number> | Record<string, number>} */ s) => {
        const entries = s instanceof Map ? [...s.entries()] : Object.entries(s);
        for (const [pid, val] of entries) {
          const pl = room.players.get(pid);
          if (pl && pl.role === 'player') {
            pl.score = Math.floor(Number(val)) || 0;
          }
        }
      },
    };

    room.game = createGame(gameType, ctx);
    room.game.onStart(options);

    return { ok: true, room };
  }

  /**
   * @param {Room} room
   * @returns {{ ok: true, room: Room }}
   */
  _returnRoomToLobby(room) {
    if (room.game && typeof room.game.onEnd === 'function') {
      try {
        room.game.onEnd();
      } catch {
        /* ignore */
      }
    }
    room.game = null;
    room.status = 'LOBBY';
    room.gameType = null;
    for (const p of room.players.values()) {
      if (p.role === 'player') p.score = 0;
    }
    const snap = this.serializeRoom(room);
    this.io.to(this._roomChannel(room.code)).emit('room_update', snap);
    this.io.to(this._roomChannel(room.code)).emit('game_update', {
      roomCode: room.code,
      roomStatus: room.status,
      state: null,
    });
    return { ok: true, room };
  }

  /**
   * @param {string} code
   * @param {string} hostSocketId
   * @param {Record<string, unknown>} payload
   */
  hostGameAction(code, hostSocketId, payload) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.hostSocketId !== hostSocketId) {
      return { ok: false, error: 'NOT_HOST' };
    }

    if (payload?.type === 'return_to_lobby') {
      if (room.status === 'LOBBY' && !room.game) {
        return { ok: false, error: 'ALREADY_IN_LOBBY' };
      }
      return this._returnRoomToLobby(room);
    }

    if (!room.game) return { ok: false, error: 'NO_GAME' };
    if (typeof room.game.onHostAction === 'function') {
      room.game.onHostAction(payload);
    }
    return { ok: true, room };
  }

  /**
   * @param {string} code
   * @param {string} playerId
   * @param {string} socketId
   * @param {Record<string, unknown>} payload
   */
  playerAction(code, playerId, socketId, payload) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'NO_GAME' };
    const room = this.rooms.get(c);
    if (!room) return { ok: false, error: 'NO_GAME' };

    if (payload?.type === 'return_to_lobby') {
      const creatorPl = room.players.get(playerId);
      if (!creatorPl || creatorPl.socketId !== socketId) {
        return { ok: false, error: 'NOT_YOUR_PLAYER' };
      }
      if (!creatorPl.isCreator) return { ok: false, error: 'NOT_CREATOR' };
      if (room.status === 'LOBBY' && !room.game) {
        return { ok: false, error: 'ALREADY_IN_LOBBY' };
      }
      return this._returnRoomToLobby(room);
    }

    if (!room.game) return { ok: false, error: 'NO_GAME' };
    const pl = room.players.get(playerId);
    if (!pl || pl.socketId !== socketId) return { ok: false, error: 'NOT_YOUR_PLAYER' };
    if (pl.role !== 'player') return { ok: false, error: 'SPECTATOR_CANNOT_PLAY' };

    room.game.onAction(playerId, payload);
    return { ok: true };
  }

  /** @param {string} code */
  endGameResults(code) {
    const c = this._normalizeCode(code);
    if (!c) return { ok: false, error: 'NO_GAME' };
    const room = this.rooms.get(c);
    if (!room?.game) return { ok: false, error: 'NO_GAME' };
    room.status = 'RESULTS';
    room.game.onEnd();
    if (typeof room.game.broadcastState === 'function') {
      room.game.broadcastState();
    } else {
      this.io.to(this._roomChannel(room.code)).emit('game_update', {
        roomCode: room.code,
        state: room.game.getState(),
        roomStatus: room.status,
      });
    }
    return { ok: true, room };
  }

  /** @param {unknown} code */
  _normalizeCode(code) {
    const digits = String(code ?? '').replace(/\D/g, '');
    return digits.length === 4 ? digits : null;
  }

  /** @param {Room} room */
  _clearOrphanTimer(room) {
    if (room.orphanTimer != null) {
      clearTimeout(room.orphanTimer);
      room.orphanTimer = null;
    }
  }

  /** @param {Room} room */
  _scheduleLobbyOrphanCleanup(room) {
    this._clearOrphanTimer(room);
    const ORPHAN_MS = 45 * 60 * 1000;
    room.orphanTimer = setTimeout(() => {
      room.orphanTimer = null;
      const r = this.rooms.get(room.code);
      if (!r) return;
      if (r.status === 'LOBBY' && r.players.size === 0 && !r.hostSocketId) {
        this.rooms.delete(r.code);
      }
    }, ORPHAN_MS);
  }

  _roomChannel(code) {
    return `room:${code}`;
  }

  /** @param {string} socketId @param {string} code */
  _joinSocketRoom(socketId, code) {
    const sock = this.io.sockets.sockets.get(socketId);
    sock?.join(this._roomChannel(code));
  }

  /** Снимок комнаты для клиентов (ROOM_UPDATE) */
  serializeRoom(room) {
    return {
      code: room.code,
      status: room.status,
      gameType: room.gameType,
      creatorPlayerId: room.creatorPlayerId ?? null,
      participants: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isCreator: p.isCreator,
        score: p.score ?? 0,
      })),
    };
  }
}
