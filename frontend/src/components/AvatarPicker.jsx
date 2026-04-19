import { AVATAR_OPTIONS } from '../data/avatarOptions.js';

/**
 * @param {{
 *   value: string;
 *   onChange: (id: string) => void;
 *   disabled?: boolean;
 *   label?: string;
 * }} props
 */
export default function AvatarPicker({
  value,
  onChange,
  disabled = false,
  label = 'Аватар',
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-500">{label}</p>
      <div
        className="grid grid-cols-5 gap-2 sm:gap-3"
        role="listbox"
        aria-label={label}
      >
        {AVATAR_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              role="option"
              aria-selected={selected}
              title={opt.label}
              onClick={() => onChange(opt.id)}
              className={`flex aspect-square items-center justify-center rounded-xl border-2 text-xl sm:text-2xl transition-colors ${
                selected
                  ? 'border-fuchsia-500 bg-fuchsia-950/50 ring-2 ring-fuchsia-500/40'
                  : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              <span aria-hidden>{opt.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
