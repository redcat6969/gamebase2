import PlayerAvatar from '../../components/PlayerAvatar.jsx';

export function hostEmitCode(state, roomCodeProp) {
  const fromState = String(state?.roomCode ?? '').replace(/\D/g, '').slice(0, 4);
  if (fromState.length === 4) return fromState;
  const fromProp = String(roomCodeProp ?? '').replace(/\D/g, '').slice(0, 4);
  return fromProp.length === 4 ? fromProp : '';
}

function SessionScoresTable({ leaderboard }) {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-slate-600/60 bg-slate-900/50 p-4">
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
 * @param {{ readOnly?: boolean }} [props]
 */
export default function CodenamesSetupPanel({
  state,
  roomCode,
  socket,
  readOnly = false,
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
        <SessionScoresTable leaderboard={leaderboard} />
        <ul className="space-y-2">
          {participants.map((p) => {
            const r = roles[p.id];
            const label =
              r?.isCaptain && r.team === 'red'
                ? 'Капитан 🔴'
                : r?.isCaptain && r.team === 'blue'
                  ? 'Капитан 🔵'
                  : r?.team === 'red'
                    ? 'Красные'
                    : r?.team === 'blue'
                      ? 'Синие'
                      : '—';
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-200"
              >
                <PlayerAvatar avatarId={p.avatar} size="sm" />
                <span className="flex-1">{p.name || 'Игрок'}</span>
                <span className="text-slate-500 text-sm">{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-950 to-slate-900 p-6">
      <button
        type="button"
        onClick={returnToGameSelection}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span aria-hidden>←</span>
        Вернуться к выбору игры
      </button>
      <h2 className="text-2xl font-bold text-emerald-200 mb-2 text-center">
        Кодовые имена — подготовка
      </h2>
      <p className="text-center text-slate-400 text-sm mb-6">
        Назначьте капитанов команд и дождитесь выбора сторон игроками, затем нажмите «Начать игру».
      </p>
      <SessionScoresTable leaderboard={leaderboard} />
      <ul className="space-y-3 mb-8">
        {participants.map((p) => {
          const r = roles[p.id];
          const label =
            r?.isCaptain && r.team === 'red'
              ? 'Капитан 🔴'
              : r?.isCaptain && r.team === 'blue'
                ? 'Капитан 🔵'
                : r?.team === 'red'
                  ? 'Красные'
                  : r?.team === 'blue'
                    ? 'Синие'
                    : '—';
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <PlayerAvatar avatarId={p.avatar} size="md" />
              <span className="text-slate-100 font-medium flex-1 min-w-[8rem]">
                {p.name || 'Игрок'}
              </span>
              <span className="text-slate-500 text-sm">{label}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => assignCaptain(p.id, 'red')}
                  className="rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/60 px-3 py-2 text-sm text-red-100"
                >
                  Капитан 🔴
                </button>
                <button
                  type="button"
                  onClick={() => assignCaptain(p.id, 'blue')}
                  className="rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-700/60 px-3 py-2 text-sm text-blue-100"
                >
                  Капитан 🔵
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={startMatch}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-4 text-lg font-bold text-white"
      >
        Начать игру
      </button>
    </div>
  );
}
