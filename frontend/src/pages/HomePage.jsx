import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function HomePage() {
  const nav = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [err, setErr] = useState('');

  function createRoom() {
    nav('/room/new/host');
  }

  function validateCode() {
    const c = codeInput.replace(/\D/g, '').slice(0, 4);
    if (c.length !== 4) {
      setErr('Введите 4-значный код');
      return null;
    }
    setErr('');
    return c;
  }

  function joinAsPlayer() {
    const c = validateCode();
    if (!c) return;
    nav(`/room/${c}/play`);
  }

  function joinAsSpectatorFromHome() {
    const c = validateCode();
    if (!c) return;
    nav(`/room/${c}/play`, { state: { joinAsSpectator: true } });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl font-black tracking-tight mb-2 text-center bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
      >
        Gamebase
      </motion.h1>
      <p className="text-slate-400 text-center mb-10 max-w-md">
        Party games в браузере. ТВ — поле, телефон — контроллер.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          type="button"
          onClick={createRoom}
          className="rounded-2xl bg-violet-600 hover:bg-violet-500 py-4 text-lg font-semibold"
        >
          Создать комнату
        </button>
        <p className="text-xs text-slate-600 text-center -mt-2">
          На следующем шаге введите имя — вы будете в игре как игрок
        </p>

        <div className="rounded-2xl border border-slate-800 p-4 flex flex-col gap-2">
          <label className="text-sm text-slate-500">Код комнаты</label>
          <input
            inputMode="numeric"
            maxLength={4}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-2xl font-mono tracking-widest text-center"
            placeholder="0000"
          />
          <button
            type="button"
            onClick={joinAsPlayer}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 py-3 font-medium"
          >
            Войти как игрок
          </button>
          <button
            type="button"
            onClick={joinAsSpectatorFromHome}
            className="rounded-xl border border-slate-600 bg-slate-900/80 hover:bg-slate-800 py-3 font-medium text-slate-200"
          >
            Войти как зритель
          </button>
          <p className="text-xs text-slate-600 text-center -mt-1">
            Общий экран игры (как на ТВ), без ввода с телефона
          </p>
        </div>
        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
      </div>
    </div>
  );
}
