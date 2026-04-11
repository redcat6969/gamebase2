import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseGame } from './BaseGame.js';

/** До скольки слов принимаем с одного игрока */
const MAX_WORDS = 5;
const DEFAULT_ROUND_S = 60;
const BETWEEN_ROUNDS_MS = 3000;
const BETWEEN_MACROS_MS = 4500;
const ROUND_SUBMIT_MS = 120000;

const __cgDir = dirname(fileURLToPath(import.meta.url));

/** @returns {string[]} */
function loadQuestionBank() {
  try {
    const raw = readFileSync(join(__cgDir, '../../questions.json'), 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((q) => typeof q === 'string' && q.trim().length > 0);
  } catch {
    return [];
  }
}

const QUESTION_BANK = loadQuestionBank();

export class CommonGuess extends BaseGame {
  constructor(ctx) {
    super(ctx);
    this.phase = 'idle';
    this.prompt = '';
    /** @type {Map<string, string[]>} playerId -> нормализованные слова */
    this.answers = new Map();
    /** @type {Map<string, number>} playerId -> очки */
    this.scores = new Map();
    /** @type {{ key: string, count: number, playerIds: string[] }[]} */
    this.clusters = [];
    /** @type {number | null} */
    this.deadlineAt = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.roundTimer = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.betweenRoundTimer = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.roundSubmitTimer = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.betweenMacroTimer = null;
    /** @type {number} */
    this.roundMs = DEFAULT_ROUND_S * 1000;

    /** @type {number} */
    this.totalRounds = 3;
    /** @type {string[]} */
    this.gameQuestions = [];
    /** @type {number} */
    this.currentMacroRoundIndex = 0;

    /** @type {string[]} слова в пуле (текущее слово раунда всё ещё в массиве до конца раунда) */
    this.gamePool = [];
    this.initialPoolSize = 0;
    /** @type {string | null} */
    this.currentWord = null;
    /** индекс currentWord в gamePool для удаления одного вхождения */
    this._currentWordPoolIndex = -1;
    this.roundIndex = 0;
    this.roundSeq = 0;
    /** @type {Map<string, { id: string, text: string }[]>} */
    this.playerWordSlots = new Map();
    /** @type {Map<string, Set<string>>} */
    this.remainingWordIds = new Map();
    /** @type {Map<string, { matched: boolean, wordId: string | null, wordText: string | null }>} */
    this.roundSubmissions = new Map();
    /** @type {Record<string, unknown> | null} */
    this.lastRoundResults = null;
  }

  /** @param {Record<string, unknown>} [options] */
  onStart(options = {}) {
    const rs =
      typeof options.roundSeconds === 'number' ? options.roundSeconds : DEFAULT_ROUND_S;
    this.roundMs = Math.max(15, Math.min(rs, 600)) * 1000;

    const trRaw = Number(options.totalRounds);
    this.totalRounds = Number.isFinite(trRaw)
      ? Math.max(1, Math.min(5, Math.floor(trRaw)))
      : 3;
    this.gameQuestions = CommonGuess.pickRandomQuestions(
      QUESTION_BANK,
      this.totalRounds
    );
    this.currentMacroRoundIndex = 0;
    this.prompt =
      this.gameQuestions[0] ??
      (typeof options.prompt === 'string' ? options.prompt : 'Ваши ассоциации');

    this.phase = 'collecting';
    this.answers.clear();
    this.scores.clear();
    this.clusters = [];
    this.gamePool = [];
    this.initialPoolSize = 0;
    this.currentWord = null;
    this._currentWordPoolIndex = -1;
    this.roundIndex = 0;
    this.roundSeq = 0;
    this.playerWordSlots.clear();
    this.remainingWordIds.clear();
    this.roundSubmissions.clear();
    this.lastRoundResults = null;
    this._clearRoundTimer();
    this._clearBetweenRoundTimer();
    this._clearRoundSubmitTimer();
    this._clearBetweenMacroTimer();

    this.deadlineAt = Date.now() + this.roundMs;
    this.roundTimer = setTimeout(() => {
      this._endCollectingPhase();
    }, this.roundMs);

    this._emitUpdate();
  }

  /**
   * @param {string[]} all
   * @param {number} n
   * @returns {string[]}
   */
  static pickRandomQuestions(all, n) {
    const need = Math.max(1, Math.min(5, Math.floor(n)));
    const pool = [...all];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const out = pool.slice(0, Math.min(need, pool.length));
    const fallback = 'Назовите что-нибудь популярное';
    while (out.length < need) {
      out.push(fallback);
    }
    return out;
  }

  /**
   * @param {string} playerId
   * @param {Record<string, unknown>} payload
   */
  onAction(playerId, payload) {
    if (payload?.type === 'submit_match') {
      this._onSubmitMatch(playerId, payload);
      return;
    }

    if (this.phase !== 'collecting') return;
    if (this.deadlineAt != null && Date.now() > this.deadlineAt) return;

    let words = [];
    if (Array.isArray(payload?.words)) {
      words = CommonGuess.normalizeWordsList(payload.words);
    } else if (typeof payload?.answer === 'string' && payload.answer.trim()) {
      words = CommonGuess.normalizeWordsList([payload.answer]);
    }

    this.answers.set(playerId, words);

    this.ctx.emitToSocket(
      this._socketIdForPlayer(playerId),
      'answer_ack',
      { ok: true }
    );
    this._emitUpdate();
  }

  /**
   * @param {string} playerId
   * @param {Record<string, unknown>} payload
   */
  _onSubmitMatch(playerId, payload) {
    if (this.phase !== 'matching') return;
    const rid = Number(payload.roundId);
    if (!Number.isFinite(rid) || rid !== this.roundSeq) return;
    if (this.roundSubmissions.has(playerId)) return;

    const matched = Boolean(payload.matched);
    const wordId =
      typeof payload.wordId === 'string' && payload.wordId.length > 0
        ? payload.wordId
        : null;
    const wordTextRaw =
      typeof payload.wordText === 'string' ? payload.wordText.trim() : '';
    const wordText = wordTextRaw.length > 0 ? wordTextRaw : null;

    this.roundSubmissions.set(playerId, { matched, wordId, wordText });

    this.ctx.emitToSocket(
      this._socketIdForPlayer(playerId),
      'submit_match_ack',
      { ok: true }
    );
    this._emitUpdate();
    this._tryResolveRound();
  }

  /** @param {Record<string, unknown>} payload */
  onHostAction(payload) {
    const type = payload?.type;
    if (type === 'finalize_round' && this.phase === 'collecting') {
      this._endCollectingPhase();
    }
  }

  onEnd() {
    this.phase = 'finished';
    this._clearRoundTimer();
    this._clearBetweenRoundTimer();
    this._clearRoundSubmitTimer();
    this._clearBetweenMacroTimer();
  }

  broadcastState() {
    this._emitUpdate();
  }

  getState() {
    return this.getHostState();
  }

  _clearRoundTimer() {
    if (this.roundTimer != null) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  _clearBetweenRoundTimer() {
    if (this.betweenRoundTimer != null) {
      clearTimeout(this.betweenRoundTimer);
      this.betweenRoundTimer = null;
    }
  }

  _clearRoundSubmitTimer() {
    if (this.roundSubmitTimer != null) {
      clearTimeout(this.roundSubmitTimer);
      this.roundSubmitTimer = null;
    }
  }

  _clearBetweenMacroTimer() {
    if (this.betweenMacroTimer != null) {
      clearTimeout(this.betweenMacroTimer);
      this.betweenMacroTimer = null;
    }
  }

  _endCollectingPhase() {
    if (this.phase !== 'collecting') return;
    this._clearRoundTimer();
    this.deadlineAt = null;

    this._buildPoolAndSlots();
    if (this.gamePool.length === 0) {
      this.phase = 'finished';
      if (typeof this.ctx.setRoomStatus === 'function') {
        this.ctx.setRoomStatus('RESULTS');
      }
      this._emitUpdate();
      return;
    }

    if (typeof this.ctx.setRoomStatus === 'function') {
      this.ctx.setRoomStatus('PLAYING');
    }
    this.phase = 'matching';
    this.roundIndex = 0;
    this._startRound();
  }

  _beginMacroCollecting() {
    this._clearBetweenMacroTimer();
    this.phase = 'collecting';
    this.answers.clear();
    this.gamePool = [];
    this.initialPoolSize = 0;
    this.playerWordSlots.clear();
    this.remainingWordIds.clear();
    this.roundSubmissions.clear();
    this.currentWord = null;
    this._currentWordPoolIndex = -1;
    this.lastRoundResults = null;
    this.roundIndex = 0;
    this.deadlineAt = Date.now() + this.roundMs;
    this._clearRoundTimer();
    this.roundTimer = setTimeout(() => {
      this._endCollectingPhase();
    }, this.roundMs);
    this._emitUpdate();
  }

  _onWordPoolExhausted() {
    this._clearBetweenRoundTimer();
    this._clearRoundSubmitTimer();

    if (this.currentMacroRoundIndex < this.totalRounds - 1) {
      this.currentMacroRoundIndex += 1;
      this.prompt =
        this.gameQuestions[this.currentMacroRoundIndex] ??
        'Назовите что-нибудь популярное';
      this.phase = 'between_macros';
      this.currentWord = null;
      this._currentWordPoolIndex = -1;
      this.roundSubmissions.clear();
      this.lastRoundResults = null;
      this.answers.clear();
      this.playerWordSlots.clear();
      this.remainingWordIds.clear();
      this.gamePool = [];
      this.initialPoolSize = 0;

      this.ctx.broadcast('NEW_ROUND', {
        roomCode: this.code,
        kind: 'macro_transition',
        currentWord: null,
        prompt: this.prompt,
        macroRound: this.currentMacroRoundIndex + 1,
        totalMacroRounds: this.totalRounds,
        roundId: this.roundSeq,
      });

      this._emitUpdate();

      this._clearBetweenMacroTimer();
      this.betweenMacroTimer = setTimeout(() => {
        this.betweenMacroTimer = null;
        this._beginMacroCollecting();
      }, BETWEEN_MACROS_MS);
      return;
    }

    this._finalizeGameOver();
  }

  _finalizeGameOver() {
    this._clearRoundTimer();
    this._clearBetweenRoundTimer();
    this._clearRoundSubmitTimer();
    this._clearBetweenMacroTimer();
    this.phase = 'finished';
    this.currentWord = null;
    this._currentWordPoolIndex = -1;
    if (typeof this.ctx.setRoomStatus === 'function') {
      this.ctx.setRoomStatus('RESULTS');
    }
    this._rebuildClustersSummary();

    const players = this.ctx.getPlayers();
    const leaderboard = [...players.values()]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        score: this.scores.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    this.ctx.broadcast('GAME_OVER', {
      roomCode: this.code,
      scores: Object.fromEntries(this.scores),
      leaderboard,
      totalRounds: this.totalRounds,
    });

    this._emitUpdate();
  }

  _buildPoolAndSlots() {
    const players = this.ctx.getPlayers();
    this.gamePool = [];
    this.playerWordSlots.clear();
    this.remainingWordIds.clear();

    for (const [pid] of players) {
      const words = this.answers.get(pid) ?? [];
      const slots = words.map((text, i) => ({
        id: `${pid}:w${i}`,
        text,
      }));
      this.playerWordSlots.set(pid, slots);
      this.remainingWordIds.set(pid, new Set(slots.map((s) => s.id)));
      for (const w of words) {
        this.gamePool.push(w);
      }
    }

    for (let i = this.gamePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.gamePool[i], this.gamePool[j]] = [this.gamePool[j], this.gamePool[i]];
    }

    this.initialPoolSize = this.gamePool.length;

    for (const [pid] of players) {
      if (!this.scores.has(pid)) this.scores.set(pid, 0);
    }
  }

  _startRound() {
    this._clearBetweenRoundTimer();
    this._clearRoundSubmitTimer();
    this.lastRoundResults = null;

    if (this.gamePool.length === 0) {
      this._onWordPoolExhausted();
      return;
    }

    const idx = Math.floor(Math.random() * this.gamePool.length);
    this._currentWordPoolIndex = idx;
    this.currentWord = this.gamePool[idx];
    this.roundIndex += 1;
    this.roundSeq += 1;
    this.roundSubmissions.clear();

    this.ctx.broadcast('NEW_ROUND', {
      roomCode: this.code,
      kind: 'word',
      currentWord: this.currentWord,
      prompt: this.prompt,
      macroRound: this.currentMacroRoundIndex + 1,
      totalMacroRounds: this.totalRounds,
      roundIndex: this.roundIndex,
      roundId: this.roundSeq,
      poolRemaining: this.gamePool.length,
      poolTotal: this.initialPoolSize,
    });

    this._emitUpdate();

    this.roundSubmitTimer = setTimeout(() => {
      this._autoFillMissingSubmissions();
    }, ROUND_SUBMIT_MS);
  }

  _autoFillMissingSubmissions() {
    if (this.phase !== 'matching') return;
    const players = this.ctx.getPlayers();
    for (const pid of players.keys()) {
      if (!this.roundSubmissions.has(pid)) {
        this.roundSubmissions.set(pid, {
          matched: false,
          wordId: null,
          wordText: null,
        });
      }
    }
    this._tryResolveRound();
  }

  _tryResolveRound() {
    if (this.phase !== 'matching') return;
    const players = this.ctx.getPlayers();
    if (this.roundSubmissions.size < players.size) return;
    this._clearRoundSubmitTimer();
    this._resolveRound();
  }

  /**
   * Находит карточку по id или по тексту (если id рассинхронизировался с клиентом).
   * @param {{ matched: boolean, wordId: string | null, wordText: string | null }} sub
   * @param {{ id: string, text: string }[]} slots
   * @param {Set<string> | undefined} rem
   * @returns {{ id: string, text: string } | null}
   */
  _resolveMatchSlot(sub, slots, rem) {
    if (!sub.matched || !rem || rem.size === 0) return null;
    if (sub.wordId && rem.has(sub.wordId)) {
      const slot = slots.find((s) => s.id === sub.wordId);
      if (slot) return slot;
    }
    if (sub.wordText) {
      const n = CommonGuess.normalizeWord(sub.wordText);
      if (!n) return null;
      const slot = slots.find(
        (s) => rem.has(s.id) && CommonGuess.normalizeWord(s.text) === n
      );
      if (slot) return slot;
    }
    return null;
  }

  _resolveRound() {
    const currentWord = this.currentWord;
    if (currentWord == null) return;

    const savedPoolIdx = this._currentWordPoolIndex;
    this._currentWordPoolIndex = -1;

    /** @type {{ pid: string, slot: { id: string, text: string } }[]} */
    const validMatchEntries = [];

    for (const [pid, sub] of this.roundSubmissions) {
      const rem = this.remainingWordIds.get(pid);
      const slots = this.playerWordSlots.get(pid) ?? [];
      const slot = this._resolveMatchSlot(sub, slots, rem);
      if (slot) validMatchEntries.push({ pid, slot });
    }

    const validMatchers = validMatchEntries.map((e) => e.pid);

    /**
     * Слово раунда всегда «съедает» одну позицию в пуле (то, что выпало на экран).
     * Затем у каждого отметившего совпадение снимаем ещё одно вхождение его текста —
     * если оно совпало с вынутым словом, первая операция уже убрала эту копию,
     * indexOf не найдёт вторую лишний раз. При разных написаниях убираем и вынутое,
     * и вариант на карточке каждого игрока.
     */
    if (savedPoolIdx >= 0 && savedPoolIdx < this.gamePool.length) {
      this.gamePool.splice(savedPoolIdx, 1);
    } else {
      const i = this.gamePool.indexOf(currentWord);
      if (i >= 0) this.gamePool.splice(i, 1);
    }

    if (validMatchEntries.length > 0) {
      for (const { pid, slot } of validMatchEntries) {
        const i = this.gamePool.indexOf(slot.text);
        if (i >= 0) this.gamePool.splice(i, 1);
        this.remainingWordIds.get(pid)?.delete(slot.id);
      }
    }

    const N = validMatchers.length;
    const pointsPerMatcher = N >= 2 ? N : 0;

    if (pointsPerMatcher > 0) {
      for (const pid of validMatchers) {
        this.scores.set(pid, (this.scores.get(pid) ?? 0) + pointsPerMatcher);
      }
    }

    const players = this.ctx.getPlayers();
    const matchersPayload = validMatchers.map((pid) => {
      const p = players.get(pid);
      return {
        playerId: pid,
        name: p?.name ?? '?',
        pointsAdded: pointsPerMatcher,
      };
    });

    this.lastRoundResults = {
      currentWord,
      roundId: this.roundSeq,
      matchers: matchersPayload,
      pointsPerMatcher,
      validMatcherIds: validMatchers,
    };

    this.ctx.broadcast('ROUND_RESULTS', {
      roomCode: this.code,
      currentWord,
      roundId: this.roundSeq,
      matchers: matchersPayload,
      pointsPerMatcher,
      scores: Object.fromEntries(this.scores),
    });

    this.currentWord = null;
    this.phase = 'round_result';
    this._emitUpdate();

    this._clearBetweenRoundTimer();
    this.betweenRoundTimer = setTimeout(() => {
      this.betweenRoundTimer = null;
      if (this.phase !== 'round_result') return;
      if (this.gamePool.length === 0) {
        this._onWordPoolExhausted();
      } else {
        this.phase = 'matching';
        this._startRound();
      }
    }, BETWEEN_ROUNDS_MS);
  }

  _rebuildClustersSummary() {
    const wordPlayers = new Map();
    for (const [pid, words] of this.answers) {
      const seen = new Set(words);
      for (const w of seen) {
        if (!wordPlayers.has(w)) wordPlayers.set(w, new Set());
        wordPlayers.get(w).add(pid);
      }
    }
    this.clusters = [...wordPlayers.entries()]
      .map(([key, pidSet]) => ({
        key,
        count: pidSet.size,
        playerIds: [...pidSet],
      }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }

  getHostState() {
    const players = this.ctx.getPlayers();
    const clusters = this.clusters.map((c) => ({
      key: c.key,
      count: c.count,
      answers: c.playerIds.map((pid) => {
        const p = players.get(pid);
        return {
          playerId: pid,
          name: p?.name ?? '?',
          answer: c.key,
        };
      }),
    }));

    let submittedPlayers = 0;
    let totalWords = 0;
    for (const words of this.answers.values()) {
      if (words.length > 0) submittedPlayers += 1;
      totalWords += words.length;
    }

    const leaderboard = [...players.values()]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        score: this.scores.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    return {
      gameType: 'common_guess',
      view: 'host',
      phase: this.phase,
      prompt: this.prompt,
      maxWords: MAX_WORDS,
      roundSeconds: Math.round(this.roundMs / 1000),
      deadlineAt: this.deadlineAt,
      answerCount: submittedPlayers,
      totalWords,
      clusters,
      leaderboard,
      currentWord: this.currentWord,
      roundIndex: this.roundIndex,
      roundId: this.roundSeq,
      poolRemaining: this.gamePool.length,
      poolTotal: this.initialPoolSize,
      submissionsReceived: this.roundSubmissions.size,
      totalPlayers: players.size,
      lastRoundResults: this.lastRoundResults,
      macroRound: this.currentMacroRoundIndex + 1,
      totalMacroRounds: this.totalRounds,
    };
  }

  /** @param {string} playerId */
  getPlayerState(playerId) {
    const myWordsRaw = this.answers.get(playerId) ?? [];
    const score = this.scores.get(playerId) ?? 0;

    const slots = this.playerWordSlots.get(playerId) ?? [];
    const rem = this.remainingWordIds.get(playerId) ?? new Set();
    const remainingWords = slots
      .filter((s) => rem.has(s.id))
      .map((s) => ({ id: s.id, word: s.text }));

    const wordPlayers = new Map();
    for (const [pid, words] of this.answers) {
      for (const w of new Set(words)) {
        if (!wordPlayers.has(w)) wordPlayers.set(w, new Set());
        wordPlayers.get(w).add(pid);
      }
    }

    const wordDetails = myWordsRaw.map((w) => {
      const set = wordPlayers.get(w);
      const matched = set != null && set.size >= 2;
      return { word: w, matched };
    });

    const players = this.ctx.getPlayers();
    const leaderboard = [...players.values()]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        score: this.scores.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    return {
      gameType: 'common_guess',
      view: 'player',
      phase: this.phase,
      prompt: this.prompt,
      maxWords: MAX_WORDS,
      roundSeconds: Math.round(this.roundMs / 1000),
      deadlineAt: this.deadlineAt,
      myWords: myWordsRaw,
      remainingWords,
      myScore: score,
      wordDetails,
      submitted: myWordsRaw.length > 0,
      currentWord: this.currentWord,
      roundIndex: this.roundIndex,
      roundId: this.roundSeq,
      poolRemaining: this.gamePool.length,
      poolTotal: this.initialPoolSize,
      hasSubmittedRound:
        this.phase === 'matching' && this.roundSubmissions.has(playerId),
      lastRoundResults: this.lastRoundResults,
      leaderboard,
      macroRound: this.currentMacroRoundIndex + 1,
      totalMacroRounds: this.totalRounds,
    };
  }

  /**
   * @param {unknown[]} raw
   * @returns {string[]}
   */
  static normalizeWordsList(raw) {
    const out = [];
    const seen = new Set();
    for (const item of raw) {
      if (out.length >= MAX_WORDS) break;
      const w = CommonGuess.normalizeWord(item);
      if (!w || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
    return out;
  }

  /** Одно слово: нижний регистр, первый токен, обрезка пунктуации по краям */
  static normalizeWord(text) {
    const s = String(text ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!s) return '';
    const first = (s.split(/\s+/)[0] ?? '').replace(
      /^[\s"«».,!?;:'—–-]+|[\s"».,!?;:'—–-]+/g,
      ''
    );
    return first.slice(0, 48);
  }

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

    if (typeof this.ctx.getParticipants === 'function') {
      for (const [pid, p] of this.ctx.getParticipants()) {
        if (p.role === 'spectator') {
          this.ctx.emitToSocket(p.socketId, 'game_update', {
            ...payloadBase,
            state: this.getHostState(),
          });
        } else {
          this.ctx.emitToSocket(p.socketId, 'game_update', {
            ...payloadBase,
            state: this.getPlayerState(pid),
          });
        }
      }
    } else {
      const hostId = this.ctx.getHostSocketId
        ? this.ctx.getHostSocketId()
        : '';
      if (hostId) {
        this.ctx.emitToSocket(hostId, 'game_update', {
          ...payloadBase,
          state: this.getHostState(),
        });
      }
      for (const [pid, pl] of this.ctx.getPlayers()) {
        this.ctx.emitToSocket(pl.socketId, 'game_update', {
          ...payloadBase,
          state: this.getPlayerState(pid),
        });
      }
    }

    if (typeof this.ctx.syncPlayerScores === 'function') {
      this.ctx.syncPlayerScores(this.scores);
    }
  }
}
