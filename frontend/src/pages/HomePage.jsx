import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { LOBBY_GAME_CARDS } from '../data/gamesCatalog.js';
import { gameRulesPath, RULES_OUTLINE_BUTTON_CLASS } from '../data/gameRulesRoutes.js';
import JoinRoomModal from '../components/JoinRoomModal.jsx';
import LandingHeroBand from '../components/LandingHeroBand.jsx';
import SiteFooter from '../components/SiteFooter.jsx';

export default function HomePage() {
  const nav = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [err, setErr] = useState('');
  const [joinModalOpen, setJoinModalOpen] = useState(false);

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
    setJoinModalOpen(false);
    nav(`/room/${c}/play`);
  }

  function joinAsSpectatorFromHome() {
    const c = validateCode();
    if (!c) return;
    setJoinModalOpen(false);
    nav(`/room/${c}/play`, { state: { joinAsSpectator: true } });
  }

  function closeJoinModal() {
    setJoinModalOpen(false);
    setErr('');
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col items-stretch overflow-x-hidden bg-slate-950">
      <LandingHeroBand>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 w-full flex justify-center sm:mb-10"
          >
            <div className="relative inline-block">
              <span
                className="pointer-events-none absolute bottom-full right-0 mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[10px]"
                aria-hidden
              >
                beta
              </span>
              <img
                src="/logocat.svg"
                alt="Gamebase"
                width={80}
                height={14}
                draggable={false}
                className="h-[18px] w-auto sm:h-5 md:h-[22px] max-w-full object-contain object-center"
              />
            </div>
          </motion.div>
          <h1 className="max-w-3xl px-1 text-center text-[38px] font-bold leading-tight tracking-tight text-slate-200 min-[700px]:text-[50px]">
            Игры для компании. Твой телефон — геймпад!
          </h1>

          <div className="mt-10 flex w-full max-w-xl flex-col gap-4 sm:mt-12 sm:flex-row sm:gap-5">
            <button
              type="button"
              onClick={createRoom}
              className="min-w-0 flex-1 rounded-2xl bg-violet-600 py-4 text-lg font-semibold hover:bg-violet-500"
            >
              Создать комнату
            </button>
            <button
              type="button"
              onClick={() => {
                setErr('');
                setJoinModalOpen(true);
              }}
              className="min-w-0 flex-1 rounded-2xl border border-slate-600/90 bg-slate-950/40 py-4 text-lg font-medium text-slate-200 backdrop-blur-sm hover:bg-slate-900/60"
            >
              Войти по коду
            </button>
          </div>
        </div>
      </LandingHeroBand>

      <JoinRoomModal
        open={joinModalOpen}
        codeInput={codeInput}
        onCodeChange={(v) => setCodeInput(v)}
        error={err}
        onJoinAsPlayer={joinAsPlayer}
        onJoinAsSpectator={joinAsSpectatorFromHome}
        onClose={closeJoinModal}
      />

      <section
        className="mx-auto mt-20 mb-20 w-full min-w-0 max-w-3xl px-4 sm:mt-24"
        aria-labelledby="how-heading"
      >
        <h2
          id="how-heading"
          className="mb-6 text-center text-2xl font-bold text-slate-200 sm:mb-8 sm:text-3xl"
        >
          Как играть
        </h2>
        <ol className="grid list-none grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-4">
          <li className="flex min-w-0 flex-col items-start gap-3 rounded-3xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-left sm:px-5 sm:py-5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/35 text-sm font-bold text-violet-200"
              aria-hidden
            >
              1
            </span>
            <p className="text-sm leading-relaxed text-slate-300">
              Собери друзей офлайн или онлайн (Discord, Zoom).
            </p>
          </li>
          <li className="flex min-w-0 flex-col items-start gap-3 rounded-3xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-left sm:px-5 sm:py-5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/35 text-sm font-bold text-violet-200"
              aria-hidden
            >
              2
            </span>
            <p className="text-sm leading-relaxed text-slate-300">
              Создай комнату. Остальные игроки смогут к ней подключиться по
              номеру или QR-коду. Там вы сможете выбрать игру.
            </p>
          </li>
          <li className="flex min-w-0 flex-col items-start gap-3 rounded-3xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-left sm:px-5 sm:py-5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/35 text-sm font-bold text-violet-200"
              aria-hidden
            >
              3
            </span>
            <p className="text-sm leading-relaxed text-slate-300">
              Остаётся только играть и веселиться!
            </p>
          </li>
        </ol>
      </section>

      <section
        className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-16"
        aria-labelledby="games-heading"
      >
        <h2
          id="games-heading"
          className="mb-6 text-center text-2xl font-bold text-slate-200 sm:mb-8 sm:text-3xl"
        >
          Игры
        </h2>
        <ul className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          {LOBBY_GAME_CARDS.map((game, i) => (
            <motion.li
              key={game.id}
              className="min-w-0 max-w-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
            >
              <article className="flex h-full min-w-0 w-full max-w-full flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 select-none">
                <div className="aspect-[16/10] bg-slate-950 border-b border-slate-800/80">
                  <img
                    src={game.image}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-6">
                  <h3 className="break-words text-xl font-semibold leading-snug text-white sm:text-2xl">
                    {game.title}
                  </h3>
                  <p className="break-words text-sm leading-relaxed text-slate-400">
                    {game.description}
                  </p>
                  {game.funOfGame ? (
                    <div className="mt-3 border-t border-slate-800/70 pt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Фан игры
                      </p>
                      <p className="break-words text-sm leading-relaxed text-slate-400/95">
                        {game.funOfGame}
                      </p>
                    </div>
                  ) : null}
                  {game.playable && game.gameType ? (
                    <Link
                      to={gameRulesPath(game.gameType)}
                      className={`mt-4 block w-full rounded-xl border py-3 text-center text-lg font-bold transition ${RULES_OUTLINE_BUTTON_CLASS[game.gameType]}`}
                    >
                      Подробные правила
                    </Link>
                  ) : null}
                </div>
              </article>
            </motion.li>
          ))}
        </ul>
        <div className="mt-8 flex w-full justify-center sm:mt-10">
          <button
            type="button"
            onClick={createRoom}
            className="w-full max-w-xl rounded-2xl bg-violet-600 py-4 text-lg font-semibold hover:bg-violet-500"
          >
            Создать комнату
          </button>
        </div>
      </section>

      <SiteFooter className="mt-auto w-full" />
    </div>
  );
}
