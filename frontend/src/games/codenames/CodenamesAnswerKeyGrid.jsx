/** Истинный цвет карточки для итоговой таблицы */
export function answerKeyCardClass(color) {
  if (color === 'red') return 'bg-red-900/85 border-red-600 text-red-50';
  if (color === 'blue') return 'bg-blue-900/85 border-blue-600 text-blue-50';
  if (color === 'assassin') return 'bg-slate-950 border-black text-slate-300';
  return 'bg-amber-900/70 border-amber-700/80 text-amber-50';
}

function colorLabel(color) {
  return color === 'neutral'
    ? 'нейтр.'
    : color === 'assassin'
      ? 'убийца'
      : color === 'red'
        ? 'красн.'
        : color === 'blue'
          ? 'син.'
          : '';
}

/**
 * Некликабельная таблица 5×5 с финальными цветами всех слов.
 * @param {{ words: { id: string, text: string, color?: string | null }[], className?: string }} props
 */
export default function CodenamesAnswerKeyGrid({ words, className = '' }) {
  return (
    <div className={className}>
      <h3 className="text-center text-slate-400 text-sm uppercase tracking-wider mb-3">
        Итоговый расклад
      </h3>
      <p className="text-center text-slate-500 text-xs mb-4">
        Все карточки с истинными цветами
      </p>
      <div className="grid grid-cols-5 gap-2">
        {(words ?? []).map((w) => (
          <div
            key={w.id}
            className={`aspect-[1.35] rounded-lg border-2 flex flex-col items-center justify-center px-1 py-2 text-center pointer-events-none select-none ${answerKeyCardClass(w.color ?? 'neutral')}`}
          >
            <span className="text-xs sm:text-sm font-bold leading-tight">{w.text}</span>
            <span className="mt-1 text-[9px] uppercase opacity-70">{colorLabel(w.color)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
