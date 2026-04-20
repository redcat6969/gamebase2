import { BaseGame } from './BaseGame.js';
import { WORD_BANK } from './codenamesWordBank.js';
import { resolveDeck } from '../gameDecks/index.js';

/**
 * @typedef {'red' | 'blue' | 'neutral' | 'assassin'} CardColor
 * @typedef {{ id: string, text: string, color: CardColor, isOpen: boolean }} BoardWord
 * @typedef {{ team: 'red' | 'blue', isCaptain: boolean }} PlayerRole
 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Codenames extends BaseGame {
  constructor(ctx) {
    super(ctx);
    /** @type {'setup' | 'playing' | 'finished'} */
    this.phase = 'setup';
    /** @type {Record<string, PlayerRole>} */
    this.roles = {};
    /** @type {BoardWord[]} */
    this.words = [];
    /** @type {'red' | 'blue'} */
    this.turn = 'red';
    /** @type {Record<string, string[]>} wordId -> playerIds */
    this.votes = {};
    /** @type {'red' | 'blue' | null} кто начинает (9 карточек) */
    this.startingTeam = 'red';
    /** @type {'red' | 'blue' | null} */
    this.winner = null;
    /** @type {string | null} */
    this.endReason = null;
    /** Очки за выигранные партии в этой сессии Codenames (сброс при новом старте из лобби) */
    /** @type {Record<string, number>} */
    this.sessionScores = {};
    /** @type {string} */
    this.deckId = 'default';
    /** @type {string} */
    this.deckTitle = '';
    /** @type {string[]} */
    this._cnWordPool = [];
  }

  hostSocketGetsHostState() {
    return false;
  }

  /** @param {Record<string, unknown>} [options] */
  onStart(options = {}) {
    const deckId =
      typeof options.deckId === 'string' && options.deckId.trim()
        ? options.deckId.trim()
        : 'default';
    this.deckId = deckId;
    const deck = resolveDeck('codenames', deckId);
    this.deckTitle = deck?.title ?? 'Колода';
    const items = deck?.items?.length >= 25 ? deck.items : [...WORD_BANK];
    this._cnWordPool = items.filter(Boolean);

    this.phase = 'setup';
    this.roles = {};
    this.words = [];
    this.turn = 'red';
    this.votes = {};
    this.winner = null;
    this.endReason = null;
    this.sessionScores = {};
    this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
    this._emitUpdate();
  }

  /** @param {Record<string, unknown>} payload */
  onHostAction(payload) {
    const type = payload?.type;
    if (type === 'ASSIGN_CAPTAIN') {
      const playerId = String(payload.playerId ?? '');
      const team = payload.team === 'blue' ? 'blue' : 'red';
      const players = this.ctx.getPlayers();
      if (!players.has(playerId)) return;
      for (const pid of Object.keys(this.roles)) {
        if (this.roles[pid]?.isCaptain && this.roles[pid]?.team === team) {
          this.roles[pid] = {
            team,
            isCaptain: false,
          };
        }
      }
      this.roles[playerId] = { team, isCaptain: true };
      this._emitUpdate();
      return;
    }
    if (type === 'RESET_TO_SETUP') {
      if (this.phase !== 'playing' && this.phase !== 'finished') return;
      this.phase = 'setup';
      this.words = [];
      this.votes = {};
      this.roles = {};
      this.turn = 'red';
      this.winner = null;
      this.endReason = null;
      this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
      this._emitUpdate();
      return;
    }
    if (type === 'START_MATCH') {
      if (this.phase !== 'setup') return;
      const players = this.ctx.getPlayers();
      const pids = [...players.keys()];
      let redCap = false;
      let blueCap = false;
      for (const pid of pids) {
        const r = this.roles[pid];
        if (r?.isCaptain && r.team === 'red') redCap = true;
        if (r?.isCaptain && r.team === 'blue') blueCap = true;
      }
      if (!redCap || !blueCap) return;
      for (const pid of pids) {
        if (!this.roles[pid]?.team) return;
      }
      this._buildBoard();
      this.phase = 'playing';
      this.turn = this.startingTeam;
      this.votes = {};
      this.winner = null;
      this.endReason = null;
      this._emitUpdate();
    }
  }

  /** +1 победителям текущей партии (по ролям на момент конца игры) */
  _bumpSessionScoresForWinners() {
    if (!this.winner) return;
    const win = this.winner;
    for (const pid of Object.keys(this.roles)) {
      if (this.roles[pid]?.team === win) {
        this.sessionScores[pid] = (this.sessionScores[pid] ?? 0) + 1;
      }
    }
  }

  /**
   * @returns {{ playerId: string, name: string, avatar: string, score: number }[]}
   */
  _sessionLeaderboard() {
    const players = this.ctx.getPlayers();
    const rows = [...players.values()].map((p) => ({
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      score: this.sessionScores[p.id] ?? 0,
    }));
    rows.sort(
      (a, b) =>
        b.score - a.score ||
        String(a.name).localeCompare(String(b.name), 'ru')
    );
    return rows;
  }

  _buildBoard() {
    const source =
      this._cnWordPool.length >= 25
        ? this._cnWordPool
        : WORD_BANK.filter(Boolean);
    const pool = shuffle([...source]);
    const texts = pool.slice(0, 25);
    const first = this.startingTeam;
    const second = first === 'red' ? 'blue' : 'red';
    /** @type {CardColor[]} */
    const colors = [];
    for (let i = 0; i < 9; i++) colors.push(first);
    for (let i = 0; i < 8; i++) colors.push(second);
    for (let i = 0; i < 7; i++) colors.push('neutral');
    colors.push('assassin');
    const shuffledColors = shuffle(colors);
    this.words = texts.map((text, i) => ({
      id: `cn-${i}`,
      text,
      color: shuffledColors[i],
      isOpen: false,
    }));
  }

  /**
   * @param {string} playerId
   * @param {Record<string, unknown>} payload
   */
  onAction(playerId, payload) {
    const type = payload?.type;
    const players = this.ctx.getPlayers();
    if (!players.has(playerId)) return;

    if (type === 'JOIN_TEAM' && this.phase === 'setup') {
      const team = payload.team === 'blue' ? 'blue' : 'red';
      const r = this.roles[playerId];
      if (r?.isCaptain) return;
      this.roles[playerId] = {
        team,
        isCaptain: false,
      };
      this._emitUpdate();
      return;
    }

    if (type === 'VOTE_WORD' && this.phase === 'playing') {
      const wordId = String(payload.wordId ?? '');
      const role = this.roles[playerId];
      if (!role?.team || role.isCaptain) return;
      if (role.team !== this.turn) return;
      const w = this.words.find((x) => x.id === wordId);
      if (!w || w.isOpen) return;

      for (const k of Object.keys(this.votes)) {
        const arr = this.votes[k];
        if (!arr) continue;
        this.votes[k] = arr.filter((id) => id !== playerId);
      }
      if (!this.votes[wordId]) this.votes[wordId] = [];
      if (!this.votes[wordId].includes(playerId)) {
        this.votes[wordId].push(playerId);
      }
      this._emitUpdate();
      return;
    }

    if (type === 'END_TURN' && this.phase === 'playing') {
      const role = this.roles[playerId];
      if (!role?.isCaptain) return;
      if (role.team !== this.turn) return;
      this.turn = this.turn === 'red' ? 'blue' : 'red';
      this.votes = {};
      this._emitUpdate();
      return;
    }

    if (type === 'REVEAL_WORD' && this.phase === 'playing') {
      const wordId = String(payload.wordId ?? '');
      const role = this.roles[playerId];
      if (!role?.isCaptain) return;
      if (role.team !== this.turn) return;
      const w = this.words.find((x) => x.id === wordId);
      if (!w || w.isOpen) return;

      w.isOpen = true;
      if (this.votes[wordId]) delete this.votes[wordId];

      if (w.color === 'assassin') {
        this.phase = 'finished';
        this.winner = role.team === 'red' ? 'blue' : 'red';
        this.endReason = 'assassin';
        this.votes = {};
        this._bumpSessionScoresForWinners();
        this._emitUpdate();
        return;
      }

      const captainTeam = role.team;
      if (w.color !== captainTeam) {
        this.turn = this.turn === 'red' ? 'blue' : 'red';
        this.votes = {};
      }

      const redLeft = this.words.some(
        (x) => x.color === 'red' && !x.isOpen
      );
      const blueLeft = this.words.some(
        (x) => x.color === 'blue' && !x.isOpen
      );
      if (!redLeft) {
        this.phase = 'finished';
        this.winner = 'red';
        this.endReason = 'cards';
        this._bumpSessionScoresForWinners();
        this._emitUpdate();
        return;
      }
      if (!blueLeft) {
        this.phase = 'finished';
        this.winner = 'blue';
        this.endReason = 'cards';
        this._bumpSessionScoresForWinners();
        this._emitUpdate();
        return;
      }

      this._emitUpdate();
    }
  }

  onEnd() {
    this.phase = 'finished';
  }

  getState() {
    return this.getHostState();
  }

  _serializeParticipants() {
    const players = this.ctx.getPlayers();
    return [...players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
    }));
  }

  _votesPayload() {
    /** @type {Record<string, string[]>} */
    const out = {};
    for (const [wid, ids] of Object.entries(this.votes)) {
      out[wid] = [...ids];
    }
    return out;
  }

  /** Сколько закрытых карточек каждого цвета (для UI у всех — у оперативников нет color у слов) */
  _cardsRemaining() {
    let red = 0;
    let blue = 0;
    for (const w of this.words) {
      if (w.isOpen) continue;
      if (w.color === 'red') red += 1;
      else if (w.color === 'blue') blue += 1;
    }
    return { red, blue };
  }

  getHostState() {
    const rem = this._cardsRemaining();
    return {
      gameType: 'codenames',
      view: 'host',
      deckId: this.deckId,
      deckTitle: this.deckTitle,
      roomCode: this.code,
      phase: this.phase,
      roles: { ...this.roles },
      words: this.words.map((w) => ({ ...w })),
      turn: this.turn,
      votes: this._votesPayload(),
      startingTeam: this.startingTeam,
      winner: this.winner,
      endReason: this.endReason,
      participants: this._serializeParticipants(),
      sessionScores: { ...this.sessionScores },
      sessionLeaderboard: this._sessionLeaderboard(),
      redCardsRemaining: rem.red,
      blueCardsRemaining: rem.blue,
    };
  }

  /**
   * @param {string} playerId
   */
  getPlayerState(playerId) {
    const players = this.ctx.getPlayers();
    const me = players.get(playerId);
    const role = this.roles[playerId];
    const isCaptain = Boolean(role?.isCaptain);

    const words = this.words.map((w) => {
      const base = {
        id: w.id,
        text: w.text,
        isOpen: w.isOpen,
      };
      if (this.phase === 'finished' || w.isOpen || isCaptain) {
        return { ...base, color: w.color };
      }
      return { ...base, color: null };
    });

    const rem = this._cardsRemaining();

    const hostSid =
      typeof this.ctx.getHostSocketId === 'function'
        ? this.ctx.getHostSocketId()
        : '';
    const creatorId =
      typeof this.ctx.getCreatorPlayerId === 'function'
        ? this.ctx.getCreatorPlayerId()
        : null;
    const showHostControls = Boolean(
      (hostSid && me?.socketId && me.socketId === hostSid) ||
      (creatorId != null && playerId === creatorId)
    );

    return {
      gameType: 'codenames',
      view: 'player',
      deckId: this.deckId,
      deckTitle: this.deckTitle,
      roomCode: this.code,
      phase: this.phase,
      showHostControls,
      myTeam: role?.team ?? null,
      isCaptain,
      roles: { ...this.roles },
      words,
      turn: this.turn,
      votes: this._votesPayload(),
      startingTeam: this.startingTeam,
      winner: this.winner,
      endReason: this.endReason,
      myName: me?.name ?? '',
      myId: playerId,
      participants: this._serializeParticipants(),
      sessionScores: { ...this.sessionScores },
      sessionLeaderboard: this._sessionLeaderboard(),
      mySessionScore: this.sessionScores[playerId] ?? 0,
      redCardsRemaining: rem.red,
      blueCardsRemaining: rem.blue,
    };
  }

  _emitUpdate() {
    const roomStatus =
      typeof this.ctx.getRoomStatus === 'function'
        ? this.ctx.getRoomStatus()
        : 'PLAYING';

    const payloadBase = { roomCode: this.code, roomStatus };

    if (typeof this.ctx.getParticipants === 'function') {
      for (const [pid, p] of this.ctx.getParticipants()) {
        if (!p.socketId) continue;
        const state =
          p.role === 'spectator'
            ? this.getHostState()
            : this.getPlayerState(pid);
        this.ctx.emitToSocket(p.socketId, 'game_update', {
          ...payloadBase,
          state,
        });
      }
    } else {
      for (const [pid, pl] of this.ctx.getPlayers()) {
        if (!pl.socketId) continue;
        const state = this.getPlayerState(pid);
        this.ctx.emitToSocket(pl.socketId, 'game_update', {
          ...payloadBase,
          state,
        });
      }
    }

    if (typeof this.ctx.syncPlayerScores === 'function') {
      this.ctx.syncPlayerScores(new Map());
    }
  }
}
