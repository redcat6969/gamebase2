import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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
      <h2 className="text-2xl font-bold text-violet-200 mb-2 text-center">Common Guess</h2>
      <p className="text-slate-200 text-center text-lg mb-4 min-h-[3rem]">
        {state.prompt || 'Вопрос'}
      </p>
      <p className="text-center text-slate-500 text-sm mb-2">
        До {state.maxWords ?? 5} слов с телефона · {state.roundSeconds ?? 60} с на сбор слов
      </p>

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
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">
              Слово раунда
            </p>
            <p className="text-4xl font-black text-white capitalize">
              {state.currentWord ?? '…'}
            </p>
            <p className="text-slate-500 text-sm mt-3">
              Раунд {state.roundIndex ?? 0}
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
          <div className="text-center rounded-xl bg-emerald-950/30 border border-emerald-800/40 py-5">
            <p className="text-slate-500 text-xs mb-1">Итог раунда</p>
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
                  className="flex justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-slate-200 text-sm"
                >
                  <span>{m.name}</span>
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
                  <span className="text-slate-300">
                    <span className="text-slate-600 mr-2">{i + 1}.</span>
                    {row.name}
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
