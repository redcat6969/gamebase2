import { motion } from 'framer-motion';
import CodenamesAnswerKeyGrid from './CodenamesAnswerKeyGrid.jsx';
import CodenamesSetupPanel from './CodenamesSetupPanel.jsx';

function cardTone(color, isOpen) {
  if (!isOpen) return 'bg-slate-700 border-slate-600 text-white';
  if (color === 'red') return 'bg-red-900/85 border-red-600 text-red-50';
  if (color === 'blue') return 'bg-blue-900/85 border-blue-600 text-blue-50';
  if (color === 'assassin') return 'bg-slate-950 border-slate-900 text-slate-200';
  return 'bg-amber-900/70 border-amber-700/80 text-amber-50';
}

function WordCard({ w, votes }) {
  const n = votes?.[w.id]?.length ?? 0;
  const open = w.isOpen;

  return (
    <motion.div
      layout
      className={`relative flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 px-0.5 py-1 text-center shadow-lg [perspective:800px] [font-size:clamp(0.45rem,2.4vmin,1rem)] sm:[font-size:clamp(0.5rem,2.6vmin,1.125rem)] ${cardTone(w.color, open)}`}
      initial={false}
      animate={{
        rotateY: open ? [0, 92, 0] : 0,
        scale: open ? [1, 0.96, 1] : 1,
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.span
        className="line-clamp-4 font-bold leading-tight break-words hyphens-auto"
        animate={{ opacity: open ? 0.95 : 1, scale: open ? 0.98 : 1 }}
        transition={{ duration: 0.35 }}
      >
        {w.text}
      </motion.span>
      {n > 0 && !open && (
        <span className="absolute top-1 right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shadow">
          {n}
        </span>
      )}
      {open && (
        <span className="absolute bottom-1 text-[10px] uppercase tracking-wider opacity-80">
          {w.color === 'neutral'
            ? 'нейтрал'
            : w.color === 'assassin'
              ? 'убийца'
              : w.color === 'red'
                ? 'красн.'
                : 'син.'}
        </span>
      )}
    </motion.div>
  );
}

/** Общий экран (зритель / ТВ): доска с цветами и голосами. В setup — только панель подготовки. */
export default function HostView({ state, roomCode, socket, readOnly = false }) {
  if (!state || state.gameType !== 'codenames') return null;

  if (state.phase === 'setup') {
    return (
      <CodenamesSetupPanel
        state={state}
        roomCode={roomCode}
        socket={socket}
        readOnly={readOnly}
      />
    );
  }

  const words = state.words ?? [];
  const votes = state.votes ?? {};
  const turn = state.turn ?? 'red';
  const finished = state.phase === 'finished';

  return (
    <div className="flex max-h-[min(100dvh,100svh)] min-h-0 flex-col overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:p-6">
      <p className="shrink-0 text-slate-500 text-xs uppercase tracking-wider mb-2 text-center">
        Трансляция комнаты
      </p>
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">Кодовые имена</h2>
        {finished ? (
          <p className="text-amber-200 font-semibold">
            Игра окончана · победа:{' '}
            {state.winner === 'red' ? '🔴 Красные' : '🔵 Синие'}
          </p>
        ) : (
          <p className="text-slate-300">
            Ход:{' '}
            <span className={turn === 'red' ? 'text-red-400' : 'text-blue-400'}>
              {turn === 'red' ? 'красных' : 'синих'}
            </span>
          </p>
        )}
      </div>
      {finished ? (
        <CodenamesAnswerKeyGrid words={words} />
      ) : (
        <div className="flex w-full min-w-0 justify-center px-0.5">
          <div
            className="grid min-h-0 w-[min(100%,calc((100dvh-15rem)*1.35),calc(100vw-1.5rem))] max-h-[calc(100dvh-15rem)] max-w-full grid-cols-[repeat(5,minmax(0,1fr))] grid-rows-[repeat(5,minmax(0,1fr))] gap-[clamp(2px,1.2vmin,8px)] aspect-[1.35]"
          >
            {words.map((w) => (
              <WordCard key={w.id} w={w} votes={votes} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
