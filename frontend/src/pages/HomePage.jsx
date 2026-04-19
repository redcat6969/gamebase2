import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { LOBBY_GAME_CARDS } from '../data/gamesCatalog.js';

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
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-12 sm:py-16">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl font-black tracking-tight mb-2 text-center bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
      >
        Gamebase
      </motion.h1>
      <p className="text-slate-400 text-center mb-8 max-w-md">
        Игры для компании. Твой телефон — геймпад!
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm mb-8">
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
          <h2 className="text-center text-slate-300 text-lg mb-1">
            Войти в комнату
          </h2>
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

      <section
        className="w-full max-w-md mb-12"
        aria-labelledby="how-heading"
      >
        <h2
          id="how-heading"
          className="text-center text-slate-300 text-lg mb-4"
        >
          Как играть
        </h2>
        <ol className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-5 space-y-4 list-none">
          <li className="flex gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/35 text-sm font-bold text-violet-200"
              aria-hidden
            >
              1
            </span>
            <p className="text-sm text-slate-300 leading-relaxed pt-0.5">
              Собери друзей офлайн или онлайн (Discord, Zoom).
            </p>
          </li>
          <li className="flex gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/35 text-sm font-bold text-violet-200"
              aria-hidden
            >
              2
            </span>
            <p className="text-sm text-slate-300 leading-relaxed pt-0.5">
              Создай комнату. Остальные игроки смогут к ней подключиться по
              номеру или QR-коду. Там вы сможете выбрать игру.
            </p>
          </li>
          <li className="flex gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/35 text-sm font-bold text-violet-200"
              aria-hidden
            >
              3
            </span>
            <p className="text-sm text-slate-300 leading-relaxed pt-0.5">
              Остаётся только играть и веселиться!
            </p>
          </li>
        </ol>
      </section>

      <section
        className="w-full max-w-2xl"
        aria-labelledby="games-heading"
      >
        <h2
          id="games-heading"
          className="text-center text-slate-300 text-lg mb-4"
        >
          Игры
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {LOBBY_GAME_CARDS.map((game, i) => (
            <motion.li
              key={game.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
            >
              <article className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col h-full select-none">
                <div className="aspect-[16/10] bg-slate-950 border-b border-slate-800/80">
                  <img
                    src={game.image}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="text-lg text-white leading-snug">{game.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {game.description}
                  </p>
                </div>
              </article>
            </motion.li>
          ))}
        </ul>
      </section>
    </div>
  );
}
