import { motion, AnimatePresence } from 'framer-motion';

const ACCENT = {
  common_guess: {
    border: 'border-fuchsia-500/40',
    selected: 'ring-2 ring-fuchsia-400 bg-fuchsia-950/30',
    name: 'Угадай общее',
  },
  codenames: {
    border: 'border-emerald-500/40',
    selected: 'ring-2 ring-emerald-400 bg-emerald-950/30',
    name: 'Кодовые имена',
  },
  never_have_i_ever: {
    border: 'border-rose-500/40',
    selected: 'ring-2 ring-rose-400 bg-rose-950/30',
    name: 'Я никогда не',
  },
};

/**
 * Выбор колоды и запуск игры (хост комнаты).
 *
 * @param {{
 *   open: boolean;
 *   gameType: 'common_guess' | 'codenames' | 'never_have_i_ever' | null;
 *   decks: { id: string; title: string; description?: string }[];
 *   decksLoading?: boolean;
 *   selectedDeckId: string | null;
 *   onSelectDeck: (id: string) => void;
 *   totalRounds: number;
 *   onTotalRoundsChange: (n: number) => void;
 *   onCancel: () => void;
 *   onConfirm: () => void;
 * }} props
 */
export default function GameLaunchModal({
  open,
  gameType,
  decks,
  decksLoading = false,
  selectedDeckId,
  onSelectDeck,
  totalRounds,
  onTotalRoundsChange,
  onCancel,
  onConfirm,
}) {
  const accent = gameType ? ACCENT[gameType] : ACCENT.common_guess;
  const showRounds = gameType === 'common_guess';
  const canLaunch = Boolean(selectedDeckId) && !decksLoading && decks.length > 0;

  return (
    <AnimatePresence>
      {open && gameType ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-launch-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={`relative flex max-h-[min(90vh,840px)] w-full max-w-lg flex-col rounded-2xl border bg-slate-900 shadow-2xl ${accent.border}`}
          >
            <div className="shrink-0 border-b border-slate-800 px-5 py-4 sm:px-6">
              <h2
                id="game-launch-title"
                className="text-xl font-bold text-white sm:text-2xl"
              >
                {accent.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Выберите колоду слов или вопросов для партии
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Колода
              </p>
              {decksLoading ? (
                <p className="text-sm text-slate-500">Загрузка списка колод…</p>
              ) : null}
              {!decksLoading && decks.length === 0 ? (
                <p className="text-sm text-amber-200/90">
                  Нет доступных колод для этой игры. Проверьте папку{' '}
                  <code className="rounded bg-slate-800 px-1">backend/src/gameDecks/bundled/</code>{' '}
                  в деплое.
                </p>
              ) : null}
              <ul className="flex flex-col gap-2">
                {decks.map((d) => {
                  const sel = selectedDeckId === d.id;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => onSelectDeck(d.id)}
                        className={`w-full rounded-xl border border-slate-700/90 px-4 py-3 text-left transition ${
                          sel ? accent.selected : 'border-slate-700 bg-slate-950/40 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="block font-semibold text-slate-100">
                          {d.title}
                        </span>
                        {d.description ? (
                          <span className="mt-1 block text-sm leading-snug text-slate-500">
                            {d.description}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {showRounds ? (
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <p className="mb-2 text-sm text-slate-400">
                    Количество раундов (вопросов)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onTotalRoundsChange(n)}
                        className={`min-w-[3rem] flex-1 rounded-xl py-3 font-mono text-lg font-bold transition-colors ${
                          totalRounds === n
                            ? 'bg-fuchsia-600 text-white ring-2 ring-fuchsia-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    В каждом раунде свой вопрос из выбранной колоды.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-slate-800 p-4 sm:px-6">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-800/80 py-3.5 font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Назад
                </button>
                <button
                  type="button"
                  disabled={!canLaunch}
                  onClick={onConfirm}
                  className="flex-1 rounded-xl bg-violet-600 py-3.5 text-lg font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Запустить игру
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
