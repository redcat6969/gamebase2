import { getAvatarEmoji } from '../data/avatarOptions.js';

/**
 * @param {{
 *   avatarId?: string | null;
 *   size?: 'sm' | 'md' | 'lg';
 *   className?: string;
 * }} props
 */
export default function PlayerAvatar({
  avatarId,
  size = 'md',
  className = '',
}) {
  const emoji = getAvatarEmoji(avatarId);
  const sizeCls =
    size === 'sm'
      ? 'h-8 w-8 text-lg'
      : size === 'lg'
        ? 'h-14 w-14 text-3xl'
        : 'h-10 w-10 text-xl';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-600 ${sizeCls} ${className}`}
      aria-hidden
    >
      {emoji}
    </span>
  );
}
