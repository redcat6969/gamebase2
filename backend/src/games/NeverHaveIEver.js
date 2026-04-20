import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAvatarId } from '../avatarIds.js';
import { BaseGame } from './BaseGame.js';
import { resolveDeck } from '../gameDecks/index.js';

const __dir = dirname(fileURLToPath(import.meta.url));

/** @returns {string[]} */
function loadQuestionBank() {
  try {
    const raw = readFileSync(join(__dir, '../../questions_never.json'), 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((q) => typeof q === 'string' && q.trim().length > 0)
      .map((s) => s.trim());
  } catch {
    return [];
  }
}

const QUESTION_BANK = loadQuestionBank();

const FALLBACK_STATEMENT =
  'Я никогда не играл в эту игру по-настоящему в большой компании';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class NeverHaveIEver extends BaseGame {
  constructor(ctx) {
    super(ctx);
    /** @type {'idle' | 'voting' | 'round_results' | 'finished'} */
    this.phase = 'idle';
    /** @type {Map<string, number>} */
    this.scores = new Map();
    /** @type {Map<string, 'was' | 'was_not'>} */
    this.votes = new Map();
    this.roundId = 0;
    this.currentStatement = '';
    /** @type {string[]} кто ответил «Было» — для показа на ТВ */
    this.wasPlayerIds = [];
    /** @type {string[]} */
    this._deck = [];
    this._deckIndex = 0;
    /** @type {string[]} исходный банк для перемешивания между кругами */
    this._sourceBank = [];
    /** @type {string} */
    this.deckId = 'default';
    /** @type {string} */
    this.deckTitle = '';
  }

  /** Ложь: ведущий тоже голосует с устройства игрока; «витрина» только у зрителей (getHostState). */
  hostSocketGetsHostState() {
    return false;
  }

  broadcastState() {
    this._emitUpdate();
  }

  getState() {
    return this.getHostState();
  }

  /** @param {Record<string, unknown>} [options] */
  onStart(options = {}) {
    const deckId =
      typeof options.deckId === 'string' && options.deckId.trim()
        ? options.deckId.trim()
        : 'default';
    this.deckId = deckId;
    const deck = resolveDeck('never_have_i_ever', deckId);
    this.deckTitle = deck?.title ?? 'Колода';
    const bankRaw =
      deck?.items?.length > 0
        ? deck.items
        : QUESTION_BANK.length > 0
          ? [...QUESTION_BANK]
          : [FALLBACK_STATEMENT];
    this._sourceBank = [...bankRaw];

    this.scores = new Map();
    this.votes = new Map();
    this.roundId = 0;
    this.wasPlayerIds = [];
    this._deck = shuffle([...this._sourceBank]);
    this._deckIndex = 0;
    this._pullNextStatement();
    this.phase = 'voting';
    this._emitUpdate();
  }

  _pullNextStatement() {
    const refill = () => {
      const base =
        this._sourceBank.length > 0
          ? [...this._sourceBank]
          : QUESTION_BANK.length > 0
            ? [...QUESTION_BANK]
            : [FALLBACK_STATEMENT];
      return shuffle(base);
    };
    if (this._deck.length === 0) {
      this._deck = refill();
      this._deckIndex = 0;
    }
    if (this._deckIndex >= this._deck.length) {
      this._deck = refill();
      this._deckIndex = 0;
    }
    this.currentStatement = this._deck[this._deckIndex++] ?? FALLBACK_STATEMENT;
    this.roundId += 1;
    this.votes.clear();
    this.wasPlayerIds = [];
  }

  /** @param {Record<string, unknown>} payload */
  onHostAction(payload) {
    const type = payload?.type;

    if (type === 'end_game') {
      this._finishGame();
      return;
    }
    if (type === 'nhie_next_question') {
      if (this.phase !== 'round_results') return;
      this._pullNextStatement();
      this.phase = 'voting';
      this._emitUpdate();
    }
  }

  /**
   * @param {string} playerId
   * @param {Record<string, unknown>} payload
   */
  onAction(playerId, payload) {
    if (payload?.type !== 'nhie_vote') return;
    if (this.phase !== 'voting') return;
    if (this.votes.has(playerId)) return;

    const raw = payload?.choice;
    const choice = raw === 'was_not' ? 'was_not' : raw === 'was' ? 'was' : null;
    if (!choice) return;

    this.votes.set(playerId, choice);
    this.ctx.emitToSocket(this._socketIdForPlayer(playerId), 'nhie_vote_ack', {
      ok: true,
    });
    /** Сразу отдаём состояние с hasVoted/myChoice, иначе UI ждёт, пока проголосуют все */
    this._emitUpdate();
    this._tryResolveRound();
  }

  _tryResolveRound() {
    const players = this.ctx.getPlayers();
    const n = players.size;
    if (n === 0) return;
    if (this.votes.size < n) return;

    /** @type {string[]} */
    const wasIds = [];
    for (const [pid, ch] of this.votes) {
      if (ch === 'was') {
        wasIds.push(pid);
        this.scores.set(pid, (this.scores.get(pid) ?? 0) + 1);
      }
    }
    this.wasPlayerIds = wasIds;
    this.phase = 'round_results';

    this.ctx.broadcast('ROUND_RESULTS', {
      roomCode: this.code,
      roundId: this.roundId,
      statement: this.currentStatement,
      wasPlayerIds: [...wasIds],
      scores: Object.fromEntries(this.scores),
    });

    this._emitUpdate();
  }

  _finishGame() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    if (typeof this.ctx.setRoomStatus === 'function') {
      this.ctx.setRoomStatus('RESULTS');
    }

    const players = this.ctx.getPlayers();
    const leaderboard = [...players.values()]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        avatar: normalizeAvatarId(p.avatar),
        score: this.scores.get(p.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          String(a.name).localeCompare(String(b.name), 'ru')
      );

    this.ctx.broadcast('GAME_OVER', {
      roomCode: this.code,
      scores: Object.fromEntries(this.scores),
      leaderboard,
    });

    this._emitUpdate();
  }

  onEnd() {
    this.phase = 'finished';
  }

  _leaderboard() {
    const players = this.ctx.getPlayers();
    return [...players.values()]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        avatar: normalizeAvatarId(p.avatar),
        score: this.scores.get(p.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          String(a.name).localeCompare(String(b.name), 'ru')
      );
  }

  _wasPlayersPayload() {
    const players = this.ctx.getPlayers();
    return this.wasPlayerIds.map((id) => {
      const p = players.get(id);
      return {
        playerId: id,
        name: p?.name ?? '?',
        avatar: normalizeAvatarId(p?.avatar),
      };
    });
  }

  getHostState() {
    return {
      roomCode: this.code,
      gameType: 'never_have_i_ever',
      view: 'host',
      deckId: this.deckId,
      deckTitle: this.deckTitle,
      phase: this.phase,
      roundId: this.roundId,
      currentStatement: this.currentStatement,
      votesReceived: this.votes.size,
      totalPlayers: this.ctx.getPlayers().size,
      wasPlayers: this._wasPlayersPayload(),
      leaderboard: this._leaderboard(),
    };
  }

  /** @param {string} playerId */
  getPlayerState(playerId) {
    const players = this.ctx.getPlayers();
    const me = players.get(playerId);
    const myScore = this.scores.get(playerId) ?? 0;
    const vote = this.votes.get(playerId);
    const hasVoted = this.votes.has(playerId);

    const hostSid =
      typeof this.ctx.getHostSocketId === 'function'
        ? this.ctx.getHostSocketId()
        : '';
    const creatorId =
      typeof this.ctx.getCreatorPlayerId === 'function'
        ? this.ctx.getCreatorPlayerId()
        : null;
    /** Следующий вопрос / конец игры — только у ведущего (сокет комнаты или создатель), не у зрителя на ТВ */
    const showHostControls = Boolean(
      (hostSid && me?.socketId && me.socketId === hostSid) ||
        (creatorId != null && playerId === creatorId)
    );

    return {
      roomCode: this.code,
      gameType: 'never_have_i_ever',
      view: 'player',
      deckId: this.deckId,
      deckTitle: this.deckTitle,
      phase: this.phase,
      roundId: this.roundId,
      currentStatement: this.currentStatement,
      /** Дублирует утверждение для клиентов; текст виден на всех этапах, где есть раунд */
      statementForPhone: this.currentStatement,
      myScore,
      leaderboard: this._leaderboard(),
      /** Как на ТВ: кто нажал «Было» (для фазы итога раунда) */
      wasPlayers: this._wasPlayersPayload(),
      totalPlayers: players.size,
      canVote: this.phase === 'voting' && !hasVoted,
      hasVoted,
      myChoice: hasVoted ? vote : null,
      myAvatar: normalizeAvatarId(me?.avatar),
      showHostControls,
    };
  }

  /** @param {string} playerId */
  _socketIdForPlayer(playerId) {
    const p = this.ctx.getPlayers().get(playerId);
    return p?.socketId ?? '';
  }

  _emitUpdate() {
    const roomStatus =
      typeof this.ctx.getRoomStatus === 'function'
        ? this.ctx.getRoomStatus()
        : 'PLAYING';

    const payloadBase = { roomCode: this.code, roomStatus };

    const emitOne = (socketId, state) => {
      this.ctx.emitToSocket(socketId, 'game_update', {
        ...payloadBase,
        state,
      });
    };

    if (typeof this.ctx.getParticipants === 'function') {
      for (const [pid, p] of this.ctx.getParticipants()) {
        if (!p.socketId) continue;
        const state =
          p.role === 'spectator'
            ? this.getHostState()
            : this.getPlayerState(pid);
        emitOne(p.socketId, state);
      }
    } else {
      for (const [pid, pl] of this.ctx.getPlayers()) {
        if (!pl.socketId) continue;
        emitOne(pl.socketId, this.getPlayerState(pid));
      }
    }

    if (typeof this.ctx.syncPlayerScores === 'function') {
      this.ctx.syncPlayerScores(this.scores);
    }
  }
}
