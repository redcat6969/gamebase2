import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORD_BANK } from '../games/codenamesWordBank.js';

const __src = dirname(fileURLToPath(import.meta.url));

/** Корень backend (…/backend) */
function backendRoot() {
  return join(__src, '..', '..');
}

/** Каталог с JSON-колодами: backend/gameDecks/<игра>/*.json */
function gameDecksRoot() {
  return join(backendRoot(), 'gameDecks');
}

/**
 * @typedef {{ id: string; title: string; description?: string; items: string[] }} Deck
 */

/** @typedef {'common_guess' | 'codenames' | 'never_have_i_ever'} GameDeckType */

const GAME_TYPES = /** @type {const} */ ([
  'common_guess',
  'codenames',
  'never_have_i_ever',
]);

/**
 * @param {unknown[]} arr
 * @returns {string[]}
 */
function normalizeItemList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((q) => typeof q === 'string' && q.trim().length > 0)
    .map((s) => s.trim());
}

/**
 * @param {string} absPath
 * @returns {string[]}
 */
function loadJsonItemsFile(absPath) {
  const raw = readFileSync(absPath, 'utf8');
  const data = JSON.parse(raw);
  return normalizeItemList(data);
}

/**
 * @param {string} deckGameDir каталог вида …/gameDecks/common_guess
 * @param {Record<string, unknown>} raw распарсенный JSON колоды
 * @returns {string[]}
 */
function resolveItems(deckGameDir, raw) {
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    return normalizeItemList(/** @type {unknown[]} */ (raw.items));
  }

  const ref = raw.itemsRef;
  if (!ref || typeof ref !== 'object') return [];

  const kind = /** @type {Record<string, unknown>} */ (ref).kind;
  if (kind === 'file' && typeof ref.path === 'string') {
    const abs = resolve(deckGameDir, ref.path);
    try {
      return loadJsonItemsFile(abs);
    } catch {
      return [];
    }
  }
  if (kind === 'codenames_word_bank') {
    return normalizeItemList([...WORD_BANK]);
  }
  if (kind === 'codenames_word_bank_slice') {
    const start = Math.max(0, Number(ref.start) || 0);
    const end =
      ref.end != null ? Number(ref.end) : WORD_BANK.filter(Boolean).length;
    return normalizeItemList(WORD_BANK.filter(Boolean).slice(start, end));
  }

  return [];
}

/**
 * @param {string} deckGameDir
 * @param {string} filename
 */
function loadOneDeckFile(deckGameDir, filename) {
  const full = join(deckGameDir, filename);
  const raw = JSON.parse(readFileSync(full, 'utf8'));
  if (!raw || typeof raw !== 'object') return null;
  const base =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : filename.replace(/\.json$/i, '');
  const items = resolveItems(deckGameDir, raw);

  const deck = {
    id: base,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : base,
    description:
      typeof raw.description === 'string' ? raw.description.trim() : '',
    items,
  };
  return deck;
}

function buildRegistry() {
  /** @type {Map<string, Map<string, Deck>>} */
  const reg = new Map();

  for (const gt of GAME_TYPES) {
    const m = new Map();
    const dir = join(gameDecksRoot(), gt);
    if (!existsSync(dir)) {
      reg.set(gt, m);
      continue;
    }
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.json') && !f.startsWith('_')
    );
    for (const f of files.sort()) {
      try {
        const deck = loadOneDeckFile(dir, f);
        if (deck && deck.id) m.set(deck.id, deck);
      } catch {
        /* skip broken file */
      }
    }
    reg.set(gt, m);
  }

  return reg;
}

const REGISTRY = buildRegistry();

/**
 * @param {GameDeckType} gameType
 * @param {string} deckId
 * @returns {Deck | null}
 */
export function resolveDeck(gameType, deckId) {
  const m = REGISTRY.get(gameType);
  if (!m) return null;
  return m.get(deckId) ?? null;
}

/**
 * @param {GameDeckType} gameType
 * @param {string} deckId
 * @returns {{ ok: true } | { ok: false }}
 */
export function assertValidDeck(gameType, deckId) {
  const d = resolveDeck(gameType, deckId);
  if (!d || !Array.isArray(d.items) || d.items.length === 0) {
    return { ok: false };
  }
  if (gameType === 'codenames' && d.items.length < 25) {
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Метаданные колод для UI (без items). Ключи — типы игр.
 * @returns {Record<string, { id: string; title: string; description: string }[]>}
 */
export function getDeckCatalogMeta() {
  /** @type {Record<string, { id: string; title: string; description: string }[]>} */
  const out = {};
  for (const gt of GAME_TYPES) {
    const m = REGISTRY.get(gt);
    const rows = [];
    if (m) {
      for (const d of m.values()) {
        rows.push({
          id: d.id,
          title: d.title,
          description: d.description ?? '',
        });
      }
      rows.sort((a, b) => {
        if (a.id === 'default') return -1;
        if (b.id === 'default') return 1;
        return a.id.localeCompare(b.id, 'en');
      });
    }
    out[gt] = rows;
  }
  return out;
}
