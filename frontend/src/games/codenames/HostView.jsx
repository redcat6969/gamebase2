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
      className={`relative aspect-[1.4] rounded-xl border-2 flex flex-col items-center justify-center px-1 py-2 text-center shadow-lg overflow-hidden [perspective:800px] ${cardTone(w.color, open)}`}
      initial={false}
      animate={{
        rotateY: open ? [0, 92, 0] : 0,
        scale: open ? [1, 0.96, 1] : 1,
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.span
        className="text-sm sm:text-base font-bold leading-tight hyphens-auto"
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:p-6">
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-2 text-center">
        Трансляция комнаты
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {words.map((w) => (
            <WordCard key={w.id} w={w} votes={votes} />
          ))}
        </div>
      )}
    </div>
  );
}
