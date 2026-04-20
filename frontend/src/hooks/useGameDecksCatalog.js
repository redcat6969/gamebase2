import { useEffect, useState } from 'react';

/**
 * Метаданные колод с бэкенда (GET /api/game-decks; файлы в backend/src/gameDecks/bundled/).
 * @returns {{ catalog: Record<string, { id: string; title: string; description: string }[]> | null; error: string | null; loading: boolean }}
 */
export function useGameDecksCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.VITE_API_URL || '';
    fetch(`${base}/api/game-decks`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
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
