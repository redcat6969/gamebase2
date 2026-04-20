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

/** Ожидаемая форма каталога с бэкенда (getDeckCatalogMeta). */
function isDeckCatalogShape(obj) {
  return (
    obj != null &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    ('common_guess' in obj || 'codenames' in obj || 'never_have_i_ever' in obj)
  );
}

/**
 * Разбор ответа на get_game_decks: обёртка { ok, catalog }, ошибка { ok: false, error },
 * либо сразу объект каталога (совместимость со старыми версиями сервера).
 * В ack может прийти несколько аргументов — берём первый подходящий.
 */
function catalogFromSocketAckArgs(...args) {
  const first = args[0];
  if (first instanceof Error) {
    return { err: first };
  }
  for (const arg of args) {
    if (arg == null || typeof arg !== 'object') continue;
    if (arg.ok === false && typeof arg.error === 'string') {
      return { err: new Error(arg.error) };
    }
    if (arg.ok === true && isDeckCatalogShape(arg.catalog)) {
      return { catalog: arg.catalog };
    }
    if (isDeckCatalogShape(arg)) {
      return { catalog: arg };
    }
  }
  return { err: new Error('Неверный ответ get_game_decks') };
}

/**
 * @returns {Promise<Record<string, { id: string; title: string; description: string }[]>>}
 */
function fetchGameDecksViaSocket() {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    const run = () => {
      s.timeout(12000).emit('get_game_decks', (...ackArgs) => {
        const { err, catalog } = catalogFromSocketAckArgs(...ackArgs);
        if (err) {
          reject(err);
          return;
        }
        if (catalog) {
          resolve(catalog);
          return;
        }
        reject(new Error('Неверный ответ get_game_decks'));
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
