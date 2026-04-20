/**
 * URL лендингов с правилами (одна каноническая страница на игру для SEO).
 */

/** @typedef {'common_guess' | 'codenames' | 'never_have_i_ever'} PlayableGameType */

/** @type {Record<string, PlayableGameType>} */
export const RULES_SLUG_TO_GAME_TYPE = {
  'common-guess': 'common_guess',
  codenames: 'codenames',
  'never-have-i-ever': 'never_have_i_ever',
};

/** @type {Record<PlayableGameType, string>} */
export const GAME_TYPE_TO_RULES_SLUG = {
  common_guess: 'common-guess',
  codenames: 'codenames',
  never_have_i_ever: 'never-have-i-ever',
};

/**
 * @param {PlayableGameType} gameType
 * @returns {string}
 */
export function gameRulesPath(gameType) {
  const slug = GAME_TYPE_TO_RULES_SLUG[gameType];
  return slug ? `/games/${slug}` : '/';
}

/**
 * @param {string | undefined} slug
 * @returns {PlayableGameType | null}
 */
export function getGameTypeFromRulesSlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return RULES_SLUG_TO_GAME_TYPE[slug] ?? null;
}

/** Классы вторичной кнопки «Подробные правила» в лобби / на главной */
export const RULES_OUTLINE_BUTTON_CLASS = {
  common_guess:
    'border-fuchsia-500/45 bg-fuchsia-950/20 text-fuchsia-200/95 hover:bg-fuchsia-950/40',
  codenames:
    'border-emerald-500/45 bg-emerald-950/20 text-emerald-200/95 hover:bg-emerald-950/40',
  never_have_i_ever:
    'border-rose-500/45 bg-rose-950/25 text-rose-100/95 hover:bg-rose-950/45',
};
