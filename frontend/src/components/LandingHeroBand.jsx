/**
 * Верхняя «лендинговая» полоса: градиент, лёгкое свечение, нижняя граница.
 * Контент передаётся children; внутренние отступы задаём на обёртке внутри.
 */
export default function LandingHeroBand({ children, className = '' }) {
  return (
    <section
      className={`relative w-full overflow-hidden border-b border-slate-800/60 bg-gradient-to-b from-violet-950/[0.38] via-slate-900/55 to-slate-950 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-[18%] -top-[35%] h-[min(380px,48vh)] w-[min(480px,88vw)] rounded-full bg-violet-500/[0.14] blur-3xl" />
        <div className="absolute -right-[12%] top-[5%] h-[min(300px,38vh)] w-[min(420px,78vw)] rounded-full bg-indigo-500/[0.09] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-px w-[min(100%,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-500/25 to-transparent" />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}
