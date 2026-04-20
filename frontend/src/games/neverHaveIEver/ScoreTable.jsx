import PlayerAvatar from '../../components/PlayerAvatar.jsx';

/**
 * Таблица счёта: +1 за каждое нажатие «Было».
 * @param {{
 *   leaderboard: { playerId: string, name: string, avatar: string, score: number }[],
 *   currentPlayerId?: string | null,
 *   className?: string,
 * }} props
 */
export default function ScoreTable({ leaderboard, currentPlayerId, className = '' }) {
  if (!leaderboard || leaderboard.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Счёт
        </p>
        <p className="text-[11px] text-slate-600">+1 за каждое «Было»</p>
      </div>
      <ol className="space-y-1.5">
        {leaderboard.map((row, i) => {
          const isMe = currentPlayerId && row.playerId === currentPlayerId;
          return (
            <li
              key={row.playerId}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-200 ${
                isMe
                  ? 'bg-rose-950/35 ring-1 ring-rose-500/25'
                  : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 tabular-nums text-slate-600">{i + 1}.</span>
                <PlayerAvatar avatarId={row.avatar} size="sm" />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums text-rose-300">
                {row.score ?? 0}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
