import { motion, AnimatePresence } from 'framer-motion';
import PlayerAvatar from '../../components/PlayerAvatar.jsx';
import ScoreTable from './ScoreTable.jsx';

function phaseLabel(phase) {
  if (phase === 'voting') return 'Голосование';
  if (phase === 'round_results') return 'Итог раунда';
  if (phase === 'finished') return 'Игра завершена';
  return '';
}

/**
 * Общий экран (ТВ / зритель): крупный текст утверждения и «Было»-аватарки.
 * @param {{ state: object | null, roomCode: string, socket: import('socket.io-client').Socket, readOnly?: boolean }} props
 * Витрина для зрителей: по умолчанию без кнопок — «Следующий вопрос» только у ведущего на экране комнаты / телефоне.
 */
export default function HostView({ state, roomCode, socket, readOnly = true }) {
  if (!state || state.gameType !== 'never_have_i_ever') return null;

  const phase = state.phase ?? 'voting';
  const statement = state.currentStatement ?? '';
  const wasPlayers = state.wasPlayers ?? [];
  const votesReceived = state.votesReceived ?? 0;
  const totalPlayers = state.totalPlayers ?? 0;
  const leaderboard = state.leaderboard ?? [];
  const finished = phase === 'finished';

  function hostAction(action) {
    if (readOnly) return;
    socket.emit('host_game_action', { code: roomCode, action });
  }

  return (
    <div className="flex min-h-[min(100dvh,100svh)] flex-col overflow-y-auto rounded-2xl border border-rose-500/25 bg-slate-950/90 p-4 sm:p-8">
      <p className="shrink-0 text-center text-xs uppercase tracking-[0.2em] text-rose-300/80">
        Я никогда не
      </p>
      <p className="mb-2 text-center text-sm text-slate-500">{phaseLabel(phase)}</p>

      <div className="mb-6 text-center">
        <p className="text-xs text-slate-500">
          Раунд #{state.roundId ?? 0}
          {phase === 'voting' ? (
            <span className="ml-2 text-rose-200/90">
              · ответили {votesReceived}/{totalPlayers}
            </span>
          ) : null}
        </p>
      </div>

      {!finished ? (
        <ScoreTable
          leaderboard={leaderboard}
          className="mx-auto mb-6 w-full max-w-xl"
        />
      ) : null}

      <AnimatePresence mode="wait">
        {finished ? (
          <motion.div
            key="final"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-2xl"
          >
            <h2 className="mb-6 text-center text-2xl font-bold text-slate-100 sm:text-3xl">
              Финал
            </h2>
            <ScoreTable leaderboard={leaderboard} className="max-w-xl mx-auto" />
            {!readOnly && (
              <button
                type="button"
                onClick={() =>
                  socket.emit('host_game_action', {
                    code: roomCode,
                    action: { type: 'return_to_lobby' },
                  })
                }
                className="mx-auto mt-8 w-full max-w-sm rounded-2xl bg-violet-600 py-4 text-lg font-semibold text-white hover:bg-violet-500"
              >
                Вернуться в комнату
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-3xl flex-1"
          >
            <motion.p
              key={statement}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="min-h-[4.5rem] text-balance text-center text-2xl font-semibold leading-snug text-slate-50 sm:min-h-[5rem] sm:text-3xl md:text-4xl"
            >
              {statement}
            </motion.p>

            {phase === 'round_results' ? (
              <p className="mt-6 text-center text-sm text-slate-500">
                «Было»: {wasPlayers.length} из {totalPlayers || '…'}
              </p>
            ) : null}

            {phase === 'round_results' && wasPlayers.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-10"
              >
                <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-rose-300">
                  Было
                </p>
                <ul className="flex flex-wrap items-center justify-center gap-4">
                  {wasPlayers.map((p, i) => (
                    <motion.li
                      key={p.playerId}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.08 * i, type: 'spring', stiffness: 260 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <PlayerAvatar avatarId={p.avatar} size="lg" />
                      <span className="max-w-[7rem] truncate text-center text-xs text-slate-400">
                        {p.name}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ) : null}

            {phase === 'round_results' && wasPlayers.length === 0 ? (
              <p className="mt-8 text-center text-slate-500">
                На этот раз все выбрали «Не было» — или компания сдержанно врёт
              </p>
            ) : null}

            {readOnly && phase === 'round_results' ? (
              <p className="mt-8 text-balance text-center text-sm text-slate-500">
                Следующий вопрос запускает ведущий в комнате (экран хоста или телефон создателя).
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {!readOnly && (
        <div className="mt-8 flex flex-col gap-3 border-t border-slate-800/80 pt-6 sm:mx-auto sm:w-full sm:max-w-xl">
          {phase === 'round_results' && (
            <button
              type="button"
              onClick={() =>
                hostAction({
                  type: 'nhie_next_question',
                })
              }
              className="w-full rounded-2xl border border-violet-500/50 bg-violet-950/40 py-4 text-lg font-semibold text-violet-100 hover:bg-violet-950/70"
            >
              Следующий вопрос
            </button>
          )}
          {!finished && (
            <button
              type="button"
              onClick={() => hostAction({ type: 'end_game' })}
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Завершить игру
            </button>
          )}
        </div>
      )}
    </div>
  );
}
