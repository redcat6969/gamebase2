import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PlayerAvatar from '../../components/PlayerAvatar.jsx';

const BLANK = () => ['', '', '', '', ''];

function RoundStrip({ state, className = '' }) {
  const mr = state?.macroRound ?? 1;
  const tr = state?.totalMacroRounds ?? 1;
  return (
    <p
      className={`text-center text-amber-200/90 text-sm font-semibold tracking-wide ${className}`}
    >
      Раунд {mr} из {tr}
    </p>
  );
}

export default function CommonGuessPlayer({
  state,
  roomCode,
  socket,
  playerId,
  isCreator = false,
}) {
  const [fields, setFields] = useState(BLANK);
  const [lastAck, setLastAck] = useState(null);
  const [now, setNow] = useState(Date.now());
  const fieldsRef = useRef(fields);
  const lastCollectingKeyRef = useRef(null);
  /** Чтобы не сбрасывать выбор при первом входе в фазу matching с тем же roundId */
  const lastRoundIdForResetRef = useRef(null);

  /** Локальный список оставшихся слов (синхронизируется с сервером) */
  const [myWords, setMyWords] = useState([]);
  const [selectedWordId, setSelectedWordId] = useState(null);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const collecting = state?.phase === 'collecting';
  const matching = state?.phase === 'matching';
  const roundResult = state?.phase === 'round_result';
  const betweenMacros = state?.phase === 'between_macros';
  const finished = state?.phase === 'finished';

  const secLeft =
    collecting && state?.deadlineAt
      ? Math.max(0, Math.ceil((state.deadlineAt - now) / 1000))
      : 0;

  useEffect(() => {
    if (!collecting || !state?.deadlineAt) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [collecting, state?.deadlineAt]);

  useEffect(() => {
    if (!collecting || !state?.deadlineAt) return;
    const key = `${state.deadlineAt}-${state.macroRound ?? 0}`;
    if (lastCollectingKeyRef.current === key) return;
    lastCollectingKeyRef.current = key;
    setFields(BLANK());
    setLastAck(null);
  }, [collecting, state?.deadlineAt, state?.macroRound]);

  // Синхронизация myWords с сервером (оставшиеся слоты)
  const remKey = JSON.stringify(state?.remainingWords ?? null);
  useEffect(() => {
    if (state?.remainingWords && (matching || roundResult || finished)) {
      setMyWords(state.remainingWords);
    }
    if (collecting || betweenMacros) {
      setMyWords([]);
      setSelectedWordId(null);
    }
  }, [
    collecting,
    betweenMacros,
    matching,
    roundResult,
    finished,
    remKey,
    state?.remainingWords,
  ]);

  // Новый раунд сверки (сменился roundId) — сброс выбора, не трогаем при первом монтировании
  useEffect(() => {
    if (!matching) {
      lastRoundIdForResetRef.current = null;
      return;
    }
    const rid = state?.roundId;
    if (rid == null) return;
    if (lastRoundIdForResetRef.current === null) {
      lastRoundIdForResetRef.current = rid;
      return;
    }
    if (lastRoundIdForResetRef.current !== rid) {
      lastRoundIdForResetRef.current = rid;
      setSelectedWordId(null);
    }
  }, [matching, state?.roundId]);

  const sendWords = useCallback(
    (words) => {
      if (!playerId || !roomCode) return;
      socket.emit('player_action', {
        code: roomCode,
        playerId,
        action: { words },
      });
    },
    [playerId, roomCode, socket]
  );

  useEffect(() => {
    function onAck(p) {
      if (p?.ok) setLastAck(true);
    }
    socket.on('answer_ack', onAck);
    return () => socket.off('answer_ack', onAck);
  }, [socket]);

  useEffect(() => {
    if (!collecting || !state?.deadlineAt || !playerId) return;
    const ms = state.deadlineAt - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => {
      const raw = fieldsRef.current.map((x) => x.trim()).filter(Boolean);
      sendWords(raw);
    }, ms);
    return () => clearTimeout(t);
  }, [collecting, state?.deadlineAt, playerId, sendWords]);

  useEffect(() => {
    if (!collecting || !playerId) return;
    const raw = fields.map((x) => x.trim()).filter(Boolean);
    if (raw.length === 0) return;
    const t = setTimeout(() => sendWords(raw), 450);
    return () => clearTimeout(t);
  }, [fields, collecting, playerId, sendWords]);

  function setField(i, v) {
    setFields((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    setLastAck(null);
  }

  const emitRoundMatch = useCallback(
    ({ matched, wordId, wordText }) => {
      if (!playerId || !roomCode || !matching) return;
      if (state?.hasSubmittedRound) return;
      const rid = state?.roundId;
      if (rid == null) return;
      socket.emit('SUBMIT_MATCH', {
        code: roomCode,
        playerId,
        roundId: rid,
        matched,
        wordId,
        wordText,
      });
    },
    [
      playerId,
      roomCode,
      matching,
      state?.hasSubmittedRound,
      state?.roundId,
      socket,
    ]
  );

  /** Нет слов в списке — сразу отправляем «нет совпадения» (один раз за раунд) */
  const emptyListAutoSubmitRoundRef = useRef(null);
  useEffect(() => {
    if (!matching || state?.hasSubmittedRound) return;
    const rid = state?.roundId;
    if (rid == null) return;
    const rw = state?.remainingWords;
    if (!Array.isArray(rw) || rw.length > 0) return;
    if (emptyListAutoSubmitRoundRef.current === rid) return;
    emptyListAutoSubmitRoundRef.current = rid;
    setSelectedWordId(null);
    emitRoundMatch({ matched: false, wordId: null, wordText: null });
  }, [
    matching,
    state?.hasSubmittedRound,
    state?.roundId,
    state?.remainingWords,
    emitRoundMatch,
  ]);

  function pickWord(id) {
    if (state?.hasSubmittedRound) return;
    const item = myWords.find((w) => w.id === id);
    if (!item) return;
    setSelectedWordId(id);
    emitRoundMatch({
      matched: true,
      wordId: id,
      wordText: item.word ?? null,
    });
  }

  function onNoWord() {
    if (state?.hasSubmittedRound) return;
    setSelectedWordId(null);
    emitRoundMatch({ matched: false, wordId: null, wordText: null });
  }

  const timeUp = collecting && secLeft <= 0;
  const disabledCollect = !collecting || timeUp;

  const poolTotal = state?.poolTotal ?? 0;
  const poolRemaining = state?.poolRemaining ?? 0;
  if (!state || state.gameType !== 'common_guess') {
    return (
      <p className="text-slate-400 text-center py-12 min-h-[40vh] flex items-center justify-center">
        Загрузка состояния игры…
      </p>
    );
  }

  if (betweenMacros) {
    return (
      <motion.div
        key="between-macros"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 max-w-md mx-auto px-4 text-center py-8"
      >
        <RoundStrip state={state} />
        <p className="text-violet-300 text-sm uppercase tracking-wider">
          Новый вопрос
        </p>
        <p className="text-white text-xl font-medium leading-snug">{state.prompt}</p>
        <p className="text-slate-500 text-sm">Скоро снова введите 5 слов…</p>
      </motion.div>
    );
  }

  if (finished) {
    const details = state.wordDetails ?? [];
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col gap-4 max-w-md mx-auto px-4"
      >
        <p className="text-slate-400 text-sm text-center">Игра окончена</p>
        <RoundStrip state={state} />
        {state.leaderboard && state.leaderboard.length >= 1 && (
          <div className="flex justify-center items-end gap-2 pt-2">
            {[
              { lbIndex: 1, place: 2 },
              { lbIndex: 0, place: 1 },
              { lbIndex: 2, place: 3 },
            ].map(({ lbIndex, place }) => {
              const row = state.leaderboard[lbIndex];
              if (!row) return <div key={place} className="flex-1 max-w-[5.5rem]" />;
              const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
              const box =
                place === 1
                  ? 'min-h-[6.5rem] bg-amber-500/15 border-amber-500/40'
                  : place === 2
                    ? 'min-h-[5rem] bg-slate-500/10 border-slate-500/35'
                    : 'min-h-[4rem] bg-orange-900/20 border-orange-800/35';
              return (
                <motion.div
                  key={row.playerId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 max-w-[6rem]"
                >
                  <div
                    className={`rounded-t-lg border flex flex-col items-center justify-end p-2 gap-1 ${box}`}
                  >
                    <span className="text-lg">{medal}</span>
                    <PlayerAvatar avatarId={row.avatar} size="sm" />
                    <span className="text-xs text-slate-200 text-center line-clamp-2 font-medium">
                      {row.name}
                    </span>
                    <span className="text-emerald-400 font-mono text-sm font-bold">
                      {row.score}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
          <p className="text-slate-500 text-sm mb-2">Твои слова (ввод)</p>
          <ul className="space-y-1 text-left">
            {details.length === 0 && (
              <li className="text-slate-600 text-sm">Ничего не введено</li>
            )}
            {details.map((d, i) => (
              <li
                key={`${d.word}-${i}`}
                className="flex justify-between gap-2 text-slate-200 capitalize"
              >
                <span>{d.word}</span>
                <span className="text-slate-600 text-sm">—</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/40 p-6 text-center">
          <p className="text-slate-400 text-sm mb-1">Твои очки</p>
          <p className="text-4xl font-black text-emerald-400">{state.myScore ?? 0}</p>
          <p className="text-slate-500 text-xs mt-3">
            +N очков, если минимум двое угадали слово раунда (N — число угадавших)
          </p>
        </div>
        {state.leaderboard && state.leaderboard.length > 0 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">
              Таблица
            </p>
            <ol className="space-y-2">
              {state.leaderboard.map((row, i) => (
                <li
                  key={row.playerId}
                  className="flex justify-between text-slate-200 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-600 shrink-0">{i + 1}.</span>
                    <PlayerAvatar avatarId={row.avatar} size="sm" />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="font-mono text-emerald-400">{row.score}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {isCreator && playerId && roomCode && (
          <button
            type="button"
            onClick={() =>
              socket.emit('player_action', {
                code: roomCode,
                playerId,
                action: { type: 'return_to_lobby' },
              })
            }
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-4 text-lg font-semibold"
          >
            Вернуться в комнату
          </button>
        )}
        {!isCreator && (
          <p className="text-center text-slate-500 text-sm">
            Создатель вернёт всех в комнату, когда закончит просмотр итогов
          </p>
        )}
      </motion.div>
    );
  }

  if (roundResult && state.lastRoundResults) {
    const lr = state.lastRoundResults;
    const me = lr.matchers?.find((m) => m.playerId === playerId);
    return (
      <motion.div
        key="round-result"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 max-w-md mx-auto px-4"
      >
        <RoundStrip state={state} />
        <p className="text-center text-violet-300 text-sm uppercase tracking-wider">
          Итог хода
        </p>
        <div className="rounded-2xl border border-violet-500/30 bg-violet-950/40 p-5 text-center">
          <p className="text-slate-500 text-xs mb-1">Слово раунда</p>
          <p className="text-2xl font-bold text-white capitalize">
            {lr.currentWord}
          </p>
        </div>
        {lr.pointsPerMatcher > 0 ? (
          <p className="text-center text-emerald-400 text-sm">
            Совпало игроков: {lr.validMatcherIds?.length ?? lr.matchers?.length ?? 0}.
            Каждый +{lr.pointsPerMatcher} очков.
          </p>
        ) : (
          <p className="text-center text-slate-500 text-sm">
            Меньше двух совпадений — очки не начислены.
          </p>
        )}
        {me && lr.pointsPerMatcher > 0 && (
          <p className="text-center text-emerald-300 text-sm">
            Ты получил +{me.pointsAdded ?? lr.pointsPerMatcher}
          </p>
        )}
        <p className="text-center text-slate-600 text-xs">Следующий раунд через 3 с…</p>
      </motion.div>
    );
  }

  if (matching) {
    const cw = state.currentWord;
    return (
      <div className="flex flex-col gap-4 max-w-md mx-auto px-4">
        <div className="text-center space-y-1">
          <RoundStrip state={state} />
          <p className="text-slate-500 text-xs line-clamp-3 px-1 leading-snug">
            {state.prompt}
          </p>
          <p className="text-slate-500 text-xs uppercase tracking-wider pt-1">
            Слово раунда
          </p>
          <motion.p
            key={cw ?? state.roundId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-3xl font-bold text-white capitalize min-h-[2.5rem]"
          >
            {cw ?? '…'}
          </motion.p>
          <p className="text-slate-500 text-sm">
            Осталось слов: {poolRemaining}/{poolTotal || poolRemaining}
          </p>
          <p className="text-slate-600 text-xs">Ход по словам: {state.roundIndex ?? 0}</p>
        </div>

        <div>
          <p className="text-slate-500 text-xs mb-2 ml-1 leading-snug">
            Если слово есть у тебя в списке — выбери его
          </p>
          <ul className="flex flex-col gap-2 min-h-[120px]">
            <AnimatePresence mode="popLayout">
              {myWords.map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, x: -12 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className={`rounded-xl border px-4 py-3 text-lg capitalize cursor-pointer select-none transition-colors ${
                    selectedWordId === item.id
                      ? 'border-emerald-500 bg-emerald-950/50 text-emerald-100 ring-2 ring-emerald-500/40'
                      : 'border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-500'
                  } ${state?.hasSubmittedRound ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => pickWord(item.id)}
                >
                  {item.word}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {myWords.length === 0 && (
            <p className="text-slate-600 text-sm text-center py-4">
              У тебя не осталось слов в списке
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onNoWord}
          disabled={state?.hasSubmittedRound}
          className="rounded-xl border border-slate-600 bg-slate-800/80 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40 py-3 text-sm text-slate-200"
        >
          У меня нет этого слова
        </button>

        {state?.hasSubmittedRound && (
          <p className="text-center text-slate-500 text-sm">
            Ответ отправлен. Ждём остальных…
          </p>
        )}
      </div>
    );
  }

  const mm = String(Math.floor(secLeft / 60)).padStart(2, '0');
  const ss = String(secLeft % 60).padStart(2, '0');
  const maxW = state.maxWords ?? 5;

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto px-4">
      <div className="text-center space-y-2">
        <RoundStrip state={state} />
        <p className="text-slate-200 text-base font-medium leading-snug px-1">
          {state.prompt}
        </p>
        <p
          className={`text-4xl font-mono font-bold ${
            secLeft <= 10 && secLeft > 0 ? 'text-red-400' : 'text-white'
          }`}
        >
          {mm}:{ss}
        </p>
        <p className="text-slate-500 text-xs mt-1">
          До {maxW} слов · вопрос дублируется на ТВ
        </p>
      </div>
      <div className="space-y-2">
        {Array.from({ length: maxW }, (_, i) => (
          <label key={i} className="block">
            <span className="text-slate-500 text-xs ml-1">Слово {i + 1}</span>
            <input
              type="text"
              value={fields[i] ?? ''}
              onChange={(e) => setField(i, e.target.value)}
              disabled={disabledCollect}
              maxLength={56}
              className="mt-0.5 w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-lg disabled:opacity-40"
              placeholder="…"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => sendWords(fields.map((x) => x.trim()).filter(Boolean))}
        disabled={disabledCollect}
        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 py-3 text-lg font-semibold"
      >
        Сохранить ответы
      </button>
      {isCreator && collecting && !timeUp && (
        <button
          type="button"
          onClick={() =>
            socket.emit('host_game_action', {
              code: roomCode,
              action: { type: 'finalize_round' },
            })
          }
          className="rounded-xl border border-amber-600/60 bg-amber-950/40 hover:bg-amber-950/70 py-3 text-amber-100 font-semibold"
        >
          Подвести итоги сейчас
        </button>
      )}
      {lastAck && !timeUp && (
        <p className="text-center text-emerald-400 text-sm">Сохранено на сервере</p>
      )}
      {timeUp && (
        <p className="text-center text-slate-500 text-sm">Время вышло, ждём раунды…</p>
      )}
    </div>
  );
}
