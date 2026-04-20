import { motion } from 'framer-motion';
import PlayerAvatar from '../../components/PlayerAvatar.jsx';
import ScoreTable from './ScoreTable.jsx';

/**
 * @param {{
 *   state: object | null,
 *   roomCode: string,
 *   socket: import('socket.io-client').Socket,
 *   playerId?: string | null,
 *   isCreator?: boolean,
 * }} props
 */
export default function PlayerView({
  state,
  roomCode,
  socket,
  playerId,
  isCreator = false,
}) {
  if (!state || state.gameType !== 'never_have_i_ever') {
    return (
      <p className="py-12 text-center text-slate-400">Загрузка состояния игры…</p>
    );
  }

  const phase = state.phase ?? 'voting';
  const text = state.statementForPhone ?? state.currentStatement ?? '';
  const finished = phase === 'finished';
  const hasVoted = state.hasVoted;
  const leaderboard = state.leaderboard ?? [];

  function sendVote(choice) {
    if (!playerId || !roomCode) return;
    socket.emit('player_action', {
      code: roomCode,
      playerId,
      action: { type: 'nhie_vote', choice },
    });
  }

  const showHostControls = Boolean(state.showHostControls);

  function hostAction(action) {
    if (!roomCode || !showHostControls) return;
    socket.emit('host_game_action', { code: roomCode, action });
  }

  if (finished) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-md flex-col gap-6 px-4"
      >
        <div className="text-center">
          <p className="text-sm uppercase tracking-wider text-slate-500">
            Итог партии
          </p>
          <p className="mt-2 text-3xl font-black text-rose-300">{state.myScore ?? 0}</p>
          <p className="text-slate-500 text-sm">твои очки за «Было»</p>
        </div>
        <ScoreTable leaderboard={leaderboard} currentPlayerId={playerId} />
        {isCreator && playerId && roomCode ? (
          <button
            type="button"
            onClick={() =>
              socket.emit('player_action', {
                code: roomCode,
                playerId,
                action: { type: 'return_to_lobby' },
              })
            }
            className="w-full rounded-2xl bg-violet-600 py-4 text-lg font-semibold text-white hover:bg-violet-500"
          >
            Вернуться в комнату
          </button>
        ) : (
          <p className="text-center text-sm text-slate-500">
            Создатель вернёт всех в комнату, когда будет готов
          </p>
        )}
      </motion.div>
    );
  }

  if (phase === 'round_results') {
    const wasPlayers = state.wasPlayers ?? [];
    const total = state.totalPlayers ?? 0;
    const wasCount = wasPlayers.length;
    const myChoice = state.myChoice;
    const myLabel =
      myChoice === 'was' ? 'Было' : myChoice === 'was_not' ? 'Не было' : null;

    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 pb-6 text-center">
        <ScoreTable leaderboard={leaderboard} currentPlayerId={playerId} />
        <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Итог раунда
        </p>
        <p className="text-balance text-lg font-medium leading-snug text-slate-100 sm:text-xl">
          {text}
        </p>
        {myLabel ? (
          <p className="rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2 text-sm text-slate-400">
            Твой ответ:{' '}
            <span
              className={
                myChoice === 'was' ? 'font-semibold text-rose-300' : 'font-semibold text-emerald-300'
              }
            >
              {myLabel}
            </span>
          </p>
        ) : null}
        <p className="text-xs text-slate-500">
          «Было»: {wasCount} из {total || '…'}
        </p>
        {wasCount > 0 ? (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-rose-300/95">
              Было
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {wasPlayers.map((p, i) => (
                <motion.li
                  key={p.playerId}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.06 * i, type: 'spring', stiffness: 280 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <PlayerAvatar avatarId={p.avatar} size="lg" />
                  <span className="max-w-[6.5rem] truncate text-center text-[11px] text-slate-400">
                    {p.name}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-slate-500 text-sm leading-relaxed">
            Никто не нажал «Было» — или все честны до конца
          </p>
        )}
        {showHostControls ? (
          <div className="mt-8 flex w-full max-w-xl flex-col gap-3 border-t border-slate-800/80 pt-6">
            <p className="text-center text-xs uppercase tracking-wider text-slate-500">
              Ведущий
            </p>
            <button
              type="button"
              onClick={() => hostAction({ type: 'nhie_next_question' })}
              className="w-full rounded-2xl border border-violet-500/50 bg-violet-950/40 py-4 text-lg font-semibold text-violet-100 hover:bg-violet-950/70"
            >
              Следующий вопрос
            </button>
            <button
              type="button"
              onClick={() => hostAction({ type: 'end_game' })}
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Завершить игру
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === 'voting') {
    const myChoice = state.myChoice;
    const pickedWas = hasVoted && myChoice === 'was';
    const pickedNot = hasVoted && myChoice === 'was_not';

    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col gap-6 px-3 pb-8">
        <ScoreTable leaderboard={leaderboard} currentPlayerId={playerId} />
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Я никогда не…
          </p>
          <p className="mt-3 text-balance text-lg font-medium leading-snug text-slate-50 sm:text-xl">
            {text}
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <motion.button
            type="button"
            whileTap={hasVoted ? undefined : { scale: 0.98 }}
            aria-pressed={pickedWas}
            onClick={() => {
              if (hasVoted) return;
              sendVote('was');
            }}
            className={`flex min-h-[140px] flex-col items-center justify-center rounded-3xl border-4 bg-gradient-to-b px-4 py-8 text-center text-2xl font-black uppercase tracking-wide text-white shadow-lg sm:min-h-[180px] sm:text-3xl ${
              pickedWas
                ? 'pointer-events-none border-amber-200/70 from-red-500 to-red-950 ring-4 ring-amber-200/90 ring-offset-2 ring-offset-slate-950 shadow-amber-500/40 scale-[1.02]'
                : pickedNot
                  ? 'pointer-events-none border-red-900/40 from-red-900/40 to-red-950/80 opacity-35 saturate-50'
                  : 'border-red-700/60 from-red-600 to-red-900 shadow-red-900/40 hover:brightness-110'
            }`}
          >
            Было
          </motion.button>
          <motion.button
            type="button"
            whileTap={hasVoted ? undefined : { scale: 0.98 }}
            aria-pressed={pickedNot}
            onClick={() => {
              if (hasVoted) return;
              sendVote('was_not');
            }}
            className={`flex min-h-[140px] flex-col items-center justify-center rounded-3xl border-4 bg-gradient-to-b px-4 py-8 text-center text-2xl font-black uppercase tracking-wide text-white shadow-lg sm:min-h-[180px] sm:text-3xl ${
              pickedNot
                ? 'pointer-events-none border-amber-200/70 from-emerald-400 to-emerald-950 ring-4 ring-amber-200/90 ring-offset-2 ring-offset-slate-950 shadow-emerald-500/40 scale-[1.02]'
                : pickedWas
                  ? 'pointer-events-none border-emerald-900/40 from-emerald-900/40 to-emerald-950/80 opacity-35 saturate-50'
                  : 'border-emerald-700/60 from-emerald-500 to-emerald-900 shadow-emerald-900/40 hover:brightness-110'
            }`}
          >
            Не было
          </motion.button>
        </div>

        {hasVoted && (
          <p className="text-center text-sm text-slate-500">
            Ответ отправлен. Ждём остальных…
          </p>
        )}
        {showHostControls ? (
          <div className="mt-6 flex w-full max-w-xl flex-col gap-3 border-t border-slate-800/80 pt-6">
            <p className="text-center text-xs uppercase tracking-wider text-slate-500">
              Ведущий
            </p>
            <button
              type="button"
              onClick={() => hostAction({ type: 'end_game' })}
              className="w-full rounded-xl border border-slate-600 bg-slate-900/80 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Завершить игру
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <p className="py-12 text-center text-slate-400">Состояние игры…</p>
  );
}
