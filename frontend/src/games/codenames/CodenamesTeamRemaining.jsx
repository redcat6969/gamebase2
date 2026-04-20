/**
 * Крупные числа: сколько закрытых карточек команды осталось на поле.
 * Числа с сервера (redCardsRemaining / blueCardsRemaining) нужны для оперативников — у закрытых клеток color не приходит.
 * @param {{
 *   words?: { color: string | null, isOpen: boolean }[],
 *   redCardsRemaining?: number,
 *   blueCardsRemaining?: number,
 *   className?: string,
 * }} props
 */
export default function CodenamesTeamRemaining({
  words,
  redCardsRemaining,
  blueCardsRemaining,
  className = '',
}) {
  const list = Array.isArray(words) ? words : [];
  const redLeft =
    typeof redCardsRemaining === 'number'
      ? redCardsRemaining
      : list.filter((w) => w.color === 'red' && !w.isOpen).length;
  const blueLeft =
    typeof blueCardsRemaining === 'number'
      ? blueCardsRemaining
      : list.filter((w) => w.color === 'blue' && !w.isOpen).length;

  return (
    <div
      className={`flex w-full justify-center ${className}`}
      role="group"
      aria-label="Осталось закрыть карточек по командам"
    >
      <div className="flex w-fit max-w-full flex-wrap items-center justify-center gap-6 sm:gap-14">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-red-400/95 sm:text-xs">
            Красные
          </span>
          <span className="text-4xl font-black tabular-nums leading-none text-red-400 sm:text-5xl">
            {redLeft}
          </span>
          <span className="text-[10px] text-slate-500 sm:text-xs">слов осталось</span>
        </div>
        <div
          className="hidden h-14 w-px shrink-0 bg-slate-700 sm:block"
          aria-hidden
        />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-400/95 sm:text-xs">
            Синие
          </span>
          <span className="text-4xl font-black tabular-nums leading-none text-blue-400 sm:text-5xl">
            {blueLeft}
          </span>
          <span className="text-[10px] text-slate-500 sm:text-xs">слов осталось</span>
        </div>
      </div>
    </div>
  );
}
