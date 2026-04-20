import { useEffect } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { getGameTypeFromRulesSlug } from '../data/gameRulesRoutes.js';
import { GameRulesArticle } from '../components/gameRules/GameRulesContent.jsx';
import LandingHeroBand from '../components/LandingHeroBand.jsx';

/** @typedef {import('../data/gameRulesRoutes.js').PlayableGameType} PlayableGameType */

/** @type {Record<PlayableGameType, { documentTitle: string; description: string }>} */
const RULES_LANDING = {
  common_guess: {
    documentTitle: 'Угадай общее — как играть онлайн | Gamebase',
    description:
      'Правила игры «Угадай общее»: ассоциации на одну тему, общий котёл слов и очки за совпадения с друзьями. Игра для компании в браузере.',
  },
  codenames: {
    documentTitle: 'Кодовые имена — правила онлайн | Gamebase',
    description:
      'Как играть в «Кодовые имена» по сети: капитан и оперативники, поле 5×5, подсказки одним словом и числом, карта убийцы.',
  },
  never_have_i_ever: {
    documentTitle: 'Я никогда не — правила игры | Gamebase',
    description:
      'Правила «Я никогда не»: голосование было или не было, очки и витрина на общем экране. Для вечеринки в Gamebase.',
  },
};

const PRIMARY_CTA_CORE =
  'block rounded-2xl bg-violet-600 px-6 py-4 text-center text-lg font-semibold text-white transition hover:bg-violet-500';

const PRIMARY_CTA_CLASS = `w-full ${PRIMARY_CTA_CORE}`;

/**
 * @param {{ gameType: PlayableGameType }} props
 */
function useRulesPageSeo({ gameType }) {
  const { documentTitle, description } = RULES_LANDING[gameType];

  useEffect(() => {
    const prevTitle = document.title;
    document.title = documentTitle;

    let meta = document.querySelector('meta[name="description"]');
    let created = false;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
      created = true;
    }
    const prevDesc = meta.getAttribute('content') ?? '';
    meta.setAttribute('content', description);

    return () => {
      document.title = prevTitle;
      if (created && meta?.parentNode) {
        meta.parentNode.removeChild(meta);
      } else if (meta) {
        meta.setAttribute('content', prevDesc);
      }
    };
  }, [documentTitle, description]);
}

/**
 * @param {{ gameType: PlayableGameType }} props
 */
function RulesHeroHeading({ gameType }) {
  const text =
    gameType === 'common_guess'
      ? 'Угадай общее'
      : gameType === 'codenames'
        ? 'Кодовые имена'
        : 'Я никогда не';
  return (
    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{text}</h1>
  );
}

export default function GameRulesPage() {
  const { slug } = useParams();
  const location = useLocation();
  const gameType = getGameTypeFromRulesSlug(slug);

  const returnTo =
    location.state && typeof location.state === 'object' && 'returnTo' in location.state
      ? /** @type {string} */ (location.state.returnTo)
      : null;

  if (!gameType) {
    return <Navigate to="/" replace />;
  }

  useRulesPageSeo({ gameType });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <LandingHeroBand>
        <div className="mx-auto max-w-2xl px-4 pb-20 pt-6 sm:px-8 sm:pb-24 sm:pt-6">
          <div className="mb-12 flex items-center justify-between gap-4 sm:mb-14">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg text-slate-200 outline-none ring-violet-500/0 transition hover:text-white focus-visible:ring-2"
            >
              <img
                src="/logocat.svg"
                alt="Gamebase — на главную"
                width={80}
                height={14}
                draggable={false}
                className="h-[18px] w-auto sm:h-5"
              />
            </Link>
            <nav className="flex shrink-0 items-center gap-3 text-sm">
              {returnTo ? (
                <Link
                  to={returnTo}
                  className="rounded-lg px-2 py-1.5 text-slate-400 transition hover:text-white"
                >
                  В комнату
                </Link>
              ) : null}
              <Link
                to="/"
                className="rounded-lg px-2 py-1.5 text-slate-300 transition hover:text-white"
              >
                На главную
              </Link>
            </nav>
          </div>
          <div className="text-center">
            <RulesHeroHeading gameType={gameType} />
            <p className="mx-auto mt-4 max-w-md text-sm text-slate-400 sm:mt-5">
              Коротко для тех, кто ни разу не играл в эту игру вживую.
            </p>
            {!returnTo ? (
              <Link
                to="/room/new/host"
                className={`w-fit ${PRIMARY_CTA_CORE} mx-auto mt-10 sm:mt-12`}
              >
                Создать комнату
              </Link>
            ) : null}
          </div>
        </div>
      </LandingHeroBand>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <GameRulesArticle gameType={gameType} />

        <div className="mt-12 flex w-full flex-col gap-3 sm:mt-14">
          {returnTo ? (
            <Link to={returnTo} className={PRIMARY_CTA_CLASS}>
              Вернуться в комнату
            </Link>
          ) : (
            <Link to="/room/new/host" className={PRIMARY_CTA_CLASS}>
              Создать комнату
            </Link>
          )}
          <Link
            to="/"
            className="w-full rounded-2xl border border-slate-600 bg-slate-900/80 py-4 text-center text-lg font-medium text-slate-200 transition hover:bg-slate-800"
          >
            На главную
          </Link>
        </div>
      </main>
    </div>
  );
}
