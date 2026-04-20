/**
 * Общий футер главной и лендингов правил.
 */
export default function SiteFooter({ className = '' }) {
  return (
    <footer
      className={`shrink-0 border-t border-slate-800/90 bg-slate-950/95 ${className}`}
    >
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
        <p>
          Контакт разработчика:{' '}
          <a
            href="https://t.me/red_cat1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline-offset-2 transition hover:text-violet-300 hover:underline"
          >
            Telegram @red_cat1
          </a>
        </p>
      </div>
    </footer>
  );
}
