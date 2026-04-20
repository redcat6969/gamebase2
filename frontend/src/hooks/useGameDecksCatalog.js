import { useEffect, useState } from 'react';

/**
 * Метаданные колод с бэкенда (GET /api/game-decks). База URL: VITE_API_URL, иначе VITE_SOCKET_URL
 * (как у сокета), иначе относительный /api — для dev-прокси или единого origin в проде.
 * @returns {{ catalog: Record<string, { id: string; title: string; description: string }[]> | null; error: string | null; loading: boolean }}
 */
function httpApiBase() {
  const raw =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_SOCKET_URL ||
    '';
  return String(raw).replace(/\/$/, '');
}

export function useGameDecksCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const base = httpApiBase();
    fetch(`${base}/api/game-decks`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        const trimmed = text.trimStart();
        if (trimmed.startsWith('<')) {
          throw new Error(
            'Сервер вернул страницу вместо JSON: запрос /api не дошёл до бэкенда. Задайте VITE_API_URL или VITE_SOCKET_URL (тот же URL, что для сокета) либо проксируйте /api на Node.'
          );
        }
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(String(e?.message ?? e));
        }
      })
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, error, loading };
}
