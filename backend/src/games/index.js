import { Codenames } from './Codenames.js';
import { CommonGuess } from './CommonGuess.js';
import { NeverHaveIEver } from './NeverHaveIEver.js';

/** @type {Record<string, typeof import('./BaseGame.js').BaseGame>} */
export const GAME_REGISTRY = {
  codenames: Codenames,
  common_guess: CommonGuess,
  never_have_i_ever: NeverHaveIEver,
};

/** Допустимые ключи после нормализации — см. normalizeGameType */
export const KNOWN_GAME_TYPES = Object.freeze(Object.keys(GAME_REGISTRY));

/**
 * Приводит значение из сокета к ключу GAME_REGISTRY (регистр, пробелы, опечатки).
 * @param {unknown} raw
 */
export function normalizeGameType(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return 'common_guess';
  s = s.toLowerCase();
  /** @type {Record<string, string>} */
  const aliases = {
    'common-guess': 'common_guess',
    commonguess: 'common_guess',
    'code-names': 'codenames',
    codename: 'codenames',
    'never-have-i-ever': 'never_have_i_ever',
    neverhaveiever: 'never_have_i_ever',
    nhie: 'never_have_i_ever',
    never_have_ever: 'never_have_i_ever',
  };
  return aliases[s] ?? s;
}

/**
 * @param {string} gameType — уже нормализованный ключ (см. normalizeGameType)
 * @param {ConstructorParameters<typeof Codenames>[0]} ctx
 */
export function createGame(gameType, ctx) {
  const Ctor = GAME_REGISTRY[gameType];
  if (!Ctor) {
    throw new Error(
      `Unknown game type: ${gameType}. Доступно: ${KNOWN_GAME_TYPES.join(', ')}`
    );
  }
  return new Ctor(ctx);
}
