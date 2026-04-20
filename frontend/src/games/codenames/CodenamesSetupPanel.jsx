import PlayerAvatar from '../../components/PlayerAvatar.jsx';

export function hostEmitCode(state, roomCodeProp) {
  const fromState = String(state?.roomCode ?? '').replace(/\D/g, '').slice(0, 4);
  if (fromState.length === 4) return fromState;
  const fromProp = String(roomCodeProp ?? '').replace(/\D/g, '').slice(0, 4);
  return fromProp.length === 4 ? fromProp : '';
}

export function SessionScoresTable({ leaderboard, className = '' }) {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) return null;
  return (
    <div
      className={`mb-6 rounded-xl border border-slate-600/60 bg-slate-900/50 p-4 ${className}`.trim()}
    >
      <h3 className="text-center text-slate-400 text-xs uppercase tracking-wider mb-1">
        Общий счёт
      </h3>
      <p className="text-center text-slate-500 text-xs mb-3">
        +1 за партию, если вы в команде победителей
      </p>
      <ul className="space-y-1.5">
        {leaderboard.map((row, i) => (
          <li
            key={row.playerId}
            className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-3 py-2 border border-slate-800/80"
          >
            <span className="text-slate-600 font-mono text-xs w-5 shrink-0">{i + 1}</span>
            <PlayerAvatar avatarId={row.avatar} size="sm" className="shrink-0" />
            <span className="flex-1 text-slate-100 text-sm truncate min-w-0">
              {row.name || 'Игрок'}
            </span>
            <span className="text-lg font-bold text-emerald-400 tabular-nums shrink-0">
              {row.score}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Экран настройки: участники, капитаны, старт.
 * @param {{ readOnly?: boolean, afterCaptainSelection?: import('react').ReactNode }} [props]
 */
export default function CodenamesSetupPanel({
  state,
  roomCode,
  socket,
  readOnly = false,
  afterCaptainSelection = null,
}) {
  if (!state || state.phase !== 'setup') return null;

  const participants = state.participants ?? [];
  const roles = state.roles ?? {};
  const leaderboard = state.sessionLeaderboard ?? [];
  const codeForSocket = hostEmitCode(state, roomCode);

  function assignCaptain(playerId, team) {
    if (readOnly || codeForSocket.length !== 4) return;
    socket.emit('host_game_action', {
      code: codeForSocket,
      action: { type: 'ASSIGN_CAPTAIN', playerId, team },
    });
  }

  function startMatch() {
    if (readOnly || codeForSocket.length !== 4) return;
    socket.emit('host_game_action', {
      code: codeForSocket,
      action: { type: 'START_MATCH' },
    });
  }

  function returnToGameSelection() {
    if (readOnly || codeForSocket.length !== 4) return;
    socket.emit('host_game_action', {
      code: codeForSocket,
      action: { type: 'return_to_lobby' },
    });
  }

  if (readOnly) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-6">
        <p className="text-slate-400 text-sm text-center mb-4">
          Трансляция подготовки. Назначение капитанов и старт — с телефона ведущего или
          создателя комнаты.
        </p>
        <h2 className="text-xl font-bold text-emerald-200 mb-4 text-center">
          Кодовые имена — подготовка
        </h2>
        <h3 className="text-center text-sm uppercase tracking-wider text-slate-400 mb-3">
          Выбор капитанов
        </h3>
        <ul className="space-y-2">
          {participants.map((p) => {
            const r = roles[p.id];
            const isRedCap = Boolean(r?.isCaptain && r.team === 'red');
            const isBlueCap = Boolean(r?.isCaptain && r.team === 'blue');
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-200"
              >
                <PlayerAvatar avatarId={p.avatar} size="sm" />
                <span className="flex-1 min-w-0 truncate">{p.name || 'Игрок'}</span>
                <div className="flex shrink-0 flex-wrap gap-2 justify-end" aria-hidden>
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                      isRedCap
                        ? 'border-red-400 bg-red-600 text-white'
                        : 'border-red-800/80 bg-red-950/50 text-red-300/50'
                    }`}
                  >
                    <span>Капитан</span>
                    <span className="text-base leading-none">🔴</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                      isBlueCap
                        ? 'border-blue-400 bg-blue-600 text-white'
                        : 'border-blue-800/80 bg-blue-950/50 text-blue-300/50'
                    }`}
                  >
                    <span>Капитан</span>
                    <span className="text-base leading-none">🔵</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-6">
          <SessionScoresTable leaderboard={leaderboard} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-950 to-slate-900 p-6">
      <h2 className="text-2xl font-bold text-emerald-200 mb-2 text-center">
        Кодовые имена — подготовка
      </h2>
      <p className="text-center text-slate-400 text-sm mb-6">
        Назначьте капитанов команд и дождитесь выбора сторон игроками, затем нажмите «Начать игру».
      </p>
      <h3 className="text-center text-sm uppercase tracking-wider text-slate-400 mb-4">
        Выбор капитанов
      </h3>
      <ul className={`space-y-3 ${afterCaptainSelection ? 'mb-0' : 'mb-8'}`}>
        {participants.map((p) => {
          const r = roles[p.id];
          const isRedCap = Boolean(r?.isCaptain && r.team === 'red');
          const isBlueCap = Boolean(r?.isCaptain && r.team === 'blue');
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <PlayerAvatar avatarId={p.avatar} size="md" />
              <span className="text-slate-100 font-medium flex-1 min-w-[8rem]">
                {p.name || 'Игрок'}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => assignCaptain(p.id, 'red')}
                  aria-pressed={isRedCap}
                  aria-label="Сделать капитаном красных"
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-2 text-sm font-semibold transition-colors ${
                    isRedCap
                      ? 'border-red-400 bg-red-600 text-white shadow-sm'
                      : 'border-red-700/60 bg-red-950/80 text-red-100 hover:bg-red-900'
                  }`}
                >
                  <span>Капитан</span>
                  <span aria-hidden className="text-base leading-none">
                    🔴
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => assignCaptain(p.id, 'blue')}
                  aria-pressed={isBlueCap}
                  aria-label="Сделать капитаном синих"
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-2 text-sm font-semibold transition-colors ${
                    isBlueCap
                      ? 'border-blue-400 bg-blue-600 text-white shadow-sm'
                      : 'border-blue-700/60 bg-blue-950/80 text-blue-100 hover:bg-blue-900'
                  }`}
                >
                  <span>Капитан</span>
                  <span aria-hidden className="text-base leading-none">
                    🔵
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {afterCaptainSelection}
      <button
        type="button"
        onClick={startMatch}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-4 text-lg font-bold text-white"
      >
        Начать игру
      </button>
      <button
        type="button"
        onClick={returnToGameSelection}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 py-4 text-lg font-bold text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span aria-hidden>←</span>
        Вернуться к выбору игры
      </button>
    </div>
  );
}
