import { motion, AnimatePresence } from 'framer-motion';

/**
 * Настройки конкретной игры — только после нажатия «Начать игру» в лобби.
 * Для новых игр добавьте ветку по gameType и свой UI + onStart(payload).
 *
 * @param {{
 *   open: boolean;
 *   gameType: string | null;
 *   totalRounds: number;
 *   onTotalRoundsChange: (n: number) => void;
 *   onCancel: () => void;
 *   onConfirm: () => void;
 * }} props
 */
export default function GameStartSetupModal({
  open,
  gameType,
  totalRounds,
  onTotalRoundsChange,
  onCancel,
  onConfirm,
}) {
  const supported = gameType === 'common_guess';

  return (
    <AnimatePresence>
      {open && supported && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
            aria-labelledby="game-start-setup-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6"
          >
            <h2
              id="game-start-setup-title"
              className="text-xl font-bold text-white text-center mb-1"
            >
              Common Guess
            </h2>
            <p className="text-sm text-slate-500 text-center mb-6">
              Перед запуском выберите параметры партии
            </p>

            <div className="mb-6">
              <p className="text-sm text-slate-400 mb-2">
                Количество раундов (вопросов)
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onTotalRoundsChange(n)}
                    className={`flex-1 min-w-[3rem] rounded-xl py-3 font-mono font-bold text-lg transition-colors ${
                      totalRounds === n
                        ? 'bg-fuchsia-600 text-white ring-2 ring-fuchsia-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                В каждом раунде свой вопрос: ввод слов, затем угадывание из общего
                пула
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800/80 hover:bg-slate-800 py-3.5 font-semibold text-slate-200"
              >
                Назад в комнату
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 py-3.5 text-lg font-bold text-white"
              >
                Запустить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
