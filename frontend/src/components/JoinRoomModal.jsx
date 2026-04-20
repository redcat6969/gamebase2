import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @param {{
 *   open: boolean;
 *   codeInput: string;
 *   onCodeChange: (value: string) => void;
 *   error: string;
 *   onJoinAsPlayer: () => void;
 *   onJoinAsSpectator: () => void;
 *   onClose: () => void;
 * }} props
 */
export default function JoinRoomModal({
  open,
  codeInput,
  onCodeChange,
  error,
  onJoinAsPlayer,
  onJoinAsSpectator,
  onClose,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
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
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-room-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 flex flex-col gap-2"
          >
            <div className="relative mb-1 pr-8">
              <h2
                id="join-room-title"
                className="text-lg font-semibold text-slate-200 text-center"
              >
                Войти в комнату
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-0 top-0 rounded-lg px-2 py-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-xl leading-none"
                aria-label="Закрыть окно"
              >
                ×
              </button>
            </div>
            <label className="text-sm text-slate-500" htmlFor="join-room-code">
              Код комнаты
            </label>
            <input
              ref={inputRef}
              id="join-room-code"
              inputMode="numeric"
              maxLength={4}
              value={codeInput}
              onChange={(e) => onCodeChange(e.target.value)}
              className="rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-2xl font-mono tracking-widest text-center"
              placeholder="0000"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={onJoinAsPlayer}
              className="mt-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-3 font-medium"
            >
              Войти как игрок
            </button>
            <button
              type="button"
              onClick={onJoinAsSpectator}
              className="rounded-xl border border-slate-600 bg-slate-900/80 hover:bg-slate-800 py-3 font-medium text-slate-200"
            >
              Войти как зритель
            </button>
            <p className="text-xs text-slate-600 text-center mt-1">
              Общий экран игры (как на ТВ), без ввода с телефона
            </p>
            {error ? (
              <p className="text-red-400 text-sm text-center pt-1">{error}</p>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
