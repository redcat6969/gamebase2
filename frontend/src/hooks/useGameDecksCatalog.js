import { useEffect, useState } from 'react';
import { getSocket } from '../socket';

/**
 * Метаданные колод с бэкенда (GET /api/game-decks или событие get_game_decks по сокету).
 * База URL для HTTP: VITE_API_URL, иначе VITE_SOCKET_URL, иначе относительный /api.
 * Если /api не проксируется на Node (в ответ приходит HTML), запрашиваем каталог по сокету.
 */
function httpApiBase() {
  const raw =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_SOCKET_URL ||
    '';
  return String(raw).replace(/\/$/, '');
}

/**
 * @returns {Promise<Record<string, { id: string; title: string; description: string }[]>>}
 */
function fetchGameDecksViaSocket() {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    const run = () => {
      /* Один аргумент: либо Error (таймаут), либо тело ответа от сервера. */
      s.timeout(12000).emit('get_game_decks', (first) => {
        if (first instanceof Error) {
          reject(first);
          return;
        }
        const res = first;
        if (res?.ok && res.catalog && typeof res.catalog === 'object') {
          resolve(res.catalog);
          return;
        }
        reject(
          new Error(
            typeof res?.error === 'string' ? res.error : 'Неверный ответ get_game_decks'
          )
        );
      });
    };

    if (s.connected) {
      run();
      return;
    }

    const t = setTimeout(
      () =>
        reject(
          new Error(
            'Сокет не подключился: проверьте VITE_SOCKET_URL и прокси /socket.io на бэкенд'
          )
        ),
      15000
    );
    s.once('connect', () => {
      clearTimeout(t);
      run();
    });
    s.once('connect_error', (e) => {
      clearTimeout(t);
      reject(
        e instanceof Error ? e : new Error(String(e?.message ?? e ?? 'connect_error'))
      );
    });
  });
}

export function useGameDecksCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const base = httpApiBase();

    (async () => {
      try {
        let data = null;
        try {
          const r = await fetch(`${base}/api/game-decks`);
          if (r.ok) {
            const text = await r.text();
            const trimmed = text.trimStart();
            if (!trimmed.startsWith('<')) {
              try {
                data = JSON.parse(text);
              } catch {
                /* fallback socket */
              }
            }
          }
        } catch {
          /* сеть / CORS — пробуем сокет */
        }
        if (!data || typeof data !== 'object') {
          data = await fetchGameDecksViaSocket();
        }
        if (!cancelled) setCatalog(data);
      } catch (e) {
        if (!cancelled) {
          setError(
            String(
              e?.message ??
                e ??
                'Не удалось загрузить колоды ни по HTTP (/api), ни по сокету'
            )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, error, loading };
}
