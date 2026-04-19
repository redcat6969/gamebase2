/**
 * Пресеты аватаров (позже можно заменить на картинки из дизайна).
 * id должны совпадать с `backend/src/avatarIds.js`.
 */
export const DEFAULT_AVATAR_ID = 'av-0';

export const AVATAR_OPTIONS = [
  { id: 'av-0', emoji: '🦊', label: 'Лиса' },
  { id: 'av-1', emoji: '🐻', label: 'Медведь' },
  { id: 'av-2', emoji: '🐸', label: 'Лягушка' },
  { id: 'av-3', emoji: '🐙', label: 'Осьминог' },
  { id: 'av-4', emoji: '🦄', label: 'Единорог' },
  { id: 'av-5', emoji: '🐲', label: 'Дракон' },
  { id: 'av-6', emoji: '🍕', label: 'Пицца' },
  { id: 'av-7', emoji: '🚀', label: 'Ракета' },
  { id: 'av-8', emoji: '🎸', label: 'Гитара' },
  { id: 'av-9', emoji: '⚡', label: 'Молния' },
];

/** @param {string | undefined | null} id */
export function getAvatarEmoji(id) {
  const row = AVATAR_OPTIONS.find((o) => o.id === id);
  return row?.emoji ?? AVATAR_OPTIONS[0].emoji;
}
