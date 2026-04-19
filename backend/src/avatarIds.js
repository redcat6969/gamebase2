/** Допустимые id аватаров (совпадают с фронтом `avatarOptions.js`). */
export const DEFAULT_AVATAR_ID = 'av-0';

const ALLOWED = new Set(
  Array.from({ length: 10 }, (_, i) => `av-${i}`)
);

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeAvatarId(raw) {
  const s = String(raw ?? '').trim();
  if (ALLOWED.has(s)) return s;
  return DEFAULT_AVATAR_ID;
}
