import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PlayerAvatar from '../../components/PlayerAvatar.jsx';

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

export default function CommonGuessHost({ state, roomCode, socket }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state?.phase !== 'collecting' || !state?.deadlineAt) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [state?.phase, state?.deadlineAt]);

  if (!state) return null;

  const collecting = state.phase === 'collecting';
  const matching = state.phase === 'matching';
  const roundResult = state.phase === 'round_result';
  const betweenMacros = state.phase === 'between_macros';
  const finished = state.phase === 'finished';

  const secLeft =
    collecting && state.deadlineAt
      ? Math.max(0, Math.ceil((state.deadlineAt - now) / 1000))
      : 0;

  function finalize() {
    socket.emit('host_game_action', {
      code: roomCode,
      action: { type: 'finalize_round' },
    });
  }

  const mm = String(Math.floor(secLeft / 60)).padStart(2, '0');
  const ss = String(secLeft % 60).padStart(2, '0');

  const poolTotal = state.poolTotal ?? 0;
  const poolRemaining = state.poolRemaining ?? 0;
  const lr = state.lastRoundResults;

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-950/40 p-6 text-left">
      <h2 className="text-2xl font-bold text-violet-200 mb-2 text-center">Угадай общее</h2>
      <RoundStrip state={state} className="mb-2" />
      <p className="text-slate-200 text-center text-lg mb-4 min-h-[3rem]">
        {state.prompt || 'Вопрос'}
      </p>
      <p className="text-center text-slate-500 text-sm mb-2">
        До {state.maxWords ?? 5} слов с телефона · {state.roundSeconds ?? 60} с на сбор слов
      </p>

      <AnimatePresence mode="wait">
        {betweenMacros && (
          <motion.div
            key="between-macros"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className="text-center py-10 rounded-xl bg-slate-900/70 border border-violet-600/30 mb-4"
          >
            <p className="text-violet-300 text-sm uppercase tracking-wider mb-3">
              Следующий вопрос
            </p>
            <p className="text-white text-xl md:text-2xl font-medium px-4">
              {state.prompt}
            </p>
            <p className="text-slate-500 text-sm mt-4">Готовимся к вводу слов…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {(matching || roundResult) && (
        <p className="text-center text-slate-400 text-sm mb-4">
          Осталось слов в пуле: {poolRemaining}/{poolTotal || poolRemaining}
        </p>
      )}

      {collecting && (
        <>
          <div className="text-center mb-6">
            <p
              className={`text-6xl font-mono font-black tracking-widest ${
                secLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'
              }`}
            >
              {mm}:{ss}
            </p>
            <p className="text-sm text-slate-500 mt-2">осталось времени</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center mb-6">
            <div className="rounded-xl bg-slate-900/60 py-3">
              <p className="text-3xl font-mono text-violet-200">{state.answerCount ?? 0}</p>
              <p className="text-xs text-slate-500">игроков с ответами</p>
            </div>
            <div className="rounded-xl bg-slate-900/60 py-3">
              <p className="text-3xl font-mono text-violet-200">{state.totalWords ?? 0}</p>
              <p className="text-xs text-slate-500">слов всего</p>
            </div>
          </div>
          <button
            type="button"
            onClick={finalize}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 py-4 text-lg font-bold"
          >
            Подвести итоги сейчас
          </button>
        </>
      )}

      {matching && (
        <motion.div
          key="matching"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="text-center rounded-xl bg-slate-900/70 border border-slate-700 py-6">
            <p className="text-slate-500 text-xs mb-2 line-clamp-3 px-2">
              {state.prompt}
            </p>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">
              Слово раунда
            </p>
            <p className="text-4xl font-black text-white capitalize">
              {state.currentWord ?? '…'}
            </p>
            <p className="text-slate-500 text-sm mt-3">
              Ход по словам: {state.roundIndex ?? 0}
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/60 py-4 text-center">
            <p className="text-2xl font-mono text-violet-200">
              {state.submissionsReceived ?? 0}/{state.totalPlayers ?? 0}
            </p>
            <p className="text-xs text-slate-500">ответов в этом раунде</p>
          </div>
        </motion.div>
      )}

      {roundResult && lr && (
        <motion.div
          key="round-result"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <RoundStrip state={state} />
          <div className="text-center rounded-xl bg-emerald-950/30 border border-emerald-800/40 py-5">
            <p className="text-slate-500 text-xs mb-1">Итог хода</p>
            <p className="text-2xl font-bold text-white capitalize">{lr.currentWord}</p>
            {lr.pointsPerMatcher > 0 ? (
              <p className="text-emerald-400 text-sm mt-2">
                +{lr.pointsPerMatcher} каждому из {lr.matchers?.length ?? 0} игроков
              </p>
            ) : (
              <p className="text-slate-500 text-sm mt-2">
                Очки не начислены (меньше двух совпадений)
              </p>
            )}
          </div>
          {lr.matchers && lr.matchers.length > 0 && (
            <ul className="space-y-2">
              {lr.matchers.map((m) => (
                <li
                  key={m.playerId}
                  className="flex justify-between items-center gap-3 rounded-lg bg-slate-900/60 px-3 py-2 text-slate-200 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar avatarId={m.avatar} size="sm" />
                    <span className="truncate">{m.name}</span>
                  </span>
                  <span className="text-emerald-400 font-mono">
                    {(m.pointsAdded ?? 0) > 0 ? `+${m.pointsAdded}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-center text-slate-600 text-xs">Следующий раунд через 3 с…</p>
        </motion.div>
      )}

      {finished && state.leaderboard && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <p className="text-center text-2xl font-black text-amber-200">Финал</p>
          <div className="flex justify-center items-end gap-2 md:gap-4 pt-2 pb-4">
            {[
              { lbIndex: 1, place: 2 },
              { lbIndex: 0, place: 1 },
              { lbIndex: 2, place: 3 },
            ].map(({ lbIndex, place }) => {
              const row = state.leaderboard[lbIndex];
              if (!row) return <div key={place} className="flex-1 max-w-[8rem]" />;
              const h =
                place === 1
                  ? 'min-h-[11rem] md:min-h-[13rem]'
                  : place === 2
                    ? 'min-h-[9rem] md:min-h-[11rem]'
                    : 'min-h-[7rem] md:min-h-[9rem]';
              const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
              return (
                <motion.div
                  key={row.playerId}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: place * 0.08 }}
                  className="flex-1 max-w-[9rem] flex flex-col items-center justify-end"
                >
                  <div
                    className={`w-full rounded-t-xl flex flex-col justify-end items-center pb-3 px-1 border flex-1 ${h} ${
                      place === 1
                        ? 'bg-amber-500/20 border-amber-500/50'
                        : place === 2
                          ? 'bg-slate-400/15 border-slate-400/40'
                          : 'bg-orange-900/25 border-orange-700/40'
                    }`}
                  >
                    <span className="text-2xl mb-1">{medal}</span>
                    <PlayerAvatar avatarId={row.avatar} size="sm" />
                    <span className="text-slate-100 text-sm font-semibold text-center line-clamp-2">
                      {row.name}
                    </span>
                    <span className="text-emerald-400 font-mono font-bold text-lg mt-1">
                      {row.score}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {state.clusters && state.clusters.length > 0 && (
            <div>
              <h3 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
                Совпадения при вводе (справочно)
              </h3>
              <ul className="space-y-3">
                {state.clusters
                  .filter((c) => c.count >= 2)
                  .sort((a, b) => b.count - a.count)
                  .map((c) => (
                    <li
                      key={c.key}
                      className="rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3"
                    >
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-white font-medium capitalize">{c.key}</span>
                        <span className="text-violet-300 font-mono">{c.count} игроков</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
              Итоговые очки
            </h3>
            <p className="text-xs text-slate-600 mb-2">
              В раундах: +N за слово, если минимум двое выбрали верное совпадение
            </p>
            <ol className="space-y-2">
              {state.leaderboard.map((row, i) => (
                <li
                  key={row.playerId}
                  className="flex justify-between rounded-lg bg-slate-900/60 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-slate-300 min-w-0">
                    <span className="text-slate-600 shrink-0">{i + 1}.</span>
                    <PlayerAvatar avatarId={row.avatar} size="sm" />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="text-emerald-400 font-mono font-semibold">{row.score}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-center text-slate-500 text-sm pt-2">
            Создатель нажмёт «Вернуться в комнату» у себя на телефоне — здесь
            откроется лобби для всех
          </p>
        </motion.div>
      )}
    </div>
  );
}
