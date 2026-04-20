import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { getSocket } from '../socket.js';
import GameContainer from '../components/GameContainer.jsx';
import GameLaunchModal from '../components/GameLaunchModal.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import { LOBBY_GAME_CARDS } from '../data/gamesCatalog.js';
import { gameRulesPath } from '../data/gameRulesRoutes.js';
import { useGameDecksCatalog } from '../hooks/useGameDecksCatalog.js';
import { DEFAULT_AVATAR_ID } from '../data/avatarOptions.js';

function normalizeRoomCode(code) {
  const d = String(code ?? '').replace(/\D/g, '');
  return d.length === 4 ? d : '';
}

function storageKeyCreator(code) {
  return `gamebase_creator_${code}`;
}

function readCreatorSession(code) {
  try {
    const raw = sessionStorage.getItem(storageKeyCreator(code));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Подсказка для игроков: ссылка на главную + QR — две вёрстки (под кодом на sm+, снизу на мобилке) */
function JoinRoomHint({ className }) {
  return (
    <p className={className}>
      Игроки могут{' '}
      <Link
        to="/"
        className="rounded-sm text-violet-300 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        зайти на сайт
      </Link>
      , ввести код комнаты и присоединиться или отсканировать QR-код камерой
      телефона.
    </p>
  );
}

export default function HostRoomPage() {
  const { code: codeParam } = useParams();
  const nav = useNavigate();
  const [socket] = useState(() => getSocket());
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [hostError, setHostError] = useState('');
  const [startError, setStartError] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [creatorAvatar, setCreatorAvatar] = useState(DEFAULT_AVATAR_ID);
  const [playerId, setPlayerId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [totalRounds, setTotalRounds] = useState(3);
  /** Модалка: выбор колоды и запуск игры */
  const [launchGameType, setLaunchGameType] = useState(
    /** @type {null | 'common_guess' | 'codenames' | 'never_have_i_ever'} */ (null),
  );
  const [selectedDeckId, setSelectedDeckId] = useState(
    /** @type {string | null} */ (null),
  );
  const creatorNameSubmittedRef = useRef('');
  const creatorAvatarSubmittedRef = useRef(DEFAULT_AVATAR_ID);
  const lastGamePayloadRef = useRef(null);
  const lastRoomRevRef = useRef(0);
  const codeRef = useRef(null);
  const codeParamRef = useRef(codeParam);
  const shareCopiedTimerRef = useRef(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const {
    catalog: gameDecksCatalog,
    error: gameDecksError,
    loading: gameDecksLoading,
  } = useGameDecksCatalog();

  const code =
    codeParam === 'new' ? null : normalizeRoomCode(codeParam) || codeParam;
  codeRef.current = code;
  codeParamRef.current = codeParam;

  useEffect(() => {
    lastRoomRevRef.current = 0;
  }, [code, codeParam]);

  const playUrl = useMemo(() => {
    if (typeof window === 'undefined' || !code) return '';
    return `${window.location.origin}/room/${code}/play`;
  }, [code]);

  const rulesReturnTo = useMemo(
    () => (!code || codeParam === 'new' ? '/room/new/host' : `/room/${code}/host`),
    [code, codeParam],
  );

  useEffect(() => {
    if (!code || !playUrl) return;
    QRCode.toDataURL(playUrl, { margin: 1, width: 220 }).then(setQrDataUrl);
  }, [code, playUrl]);

  useEffect(() => {
    return () => {
      if (shareCopiedTimerRef.current) {
        clearTimeout(shareCopiedTimerRef.current);
      }
    };
  }, []);

  const copyRoomPlayLink = useCallback(async () => {
    if (!playUrl) return;
    const ok = async () => {
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
      setShareLinkCopied(true);
      shareCopiedTimerRef.current = setTimeout(() => {
        setShareLinkCopied(false);
        shareCopiedTimerRef.current = null;
      }, 2200);
    };
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(playUrl);
        await ok();
        return;
      }
    } catch {
      /* fallback */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = playUrl;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      await ok();
    } catch {
      setHostError('Не удалось скопировать ссылку');
      setTimeout(() => setHostError(''), 3000);
    }
  }, [playUrl]);

  const persistCreator = useCallback((c, data) => {
    sessionStorage.setItem(storageKeyCreator(c), JSON.stringify(data));
  }, []);

  useEffect(() => {
    function onRoomUpdate(p) {
      const rev = p?.rev;
      if (typeof rev === 'number') {
        if (rev <= lastRoomRevRef.current) {
          return;
        }
        lastRoomRevRef.current = rev;
      }
      setRoom(p);
      setRoomStatus(p?.status ?? null);
      setHostError('');
      if (p?.status === 'PLAYING' || p?.status === 'RESULTS') setStartError('');
      setGameState((prev) => {
        if (p?.status === 'LOBBY' && (p.gameType == null || p.gameType === '')) {
          return null;
        }
        if (
          p?.status === 'PLAYING' &&
          typeof p?.gameType === 'string' &&
          prev &&
          typeof prev.gameType === 'string' &&
          prev.gameType !== p.gameType
        ) {
          return null;
        }
        return prev;
      });
    }
    function onGameUpdate(p) {
      const next = p?.state ?? null;
      lastGamePayloadRef.current = next;
      setGameState(next);
      if (next === null) {
        const rs = p?.roomStatus ?? 'LOBBY';
        setRoomStatus(rs);
        if (rs === 'LOBBY') {
          setRoom((r) =>
            r ? { ...r, status: 'LOBBY', gameType: null } : r
          );
        }
      } else {
        const rs = p?.roomStatus;
        if (rs) setRoomStatus(rs);
        const gt =
          typeof next.gameType === 'string' ? next.gameType : null;
        if (gt) {
          const st = rs ?? 'PLAYING';
          setRoom((r) =>
            r ? { ...r, status: st, gameType: gt } : r
          );
          if (!rs) setRoomStatus(st);
        }
      }
    }
    function onRoomCreated(p) {
      const created = p.code;
      setCreating(false);
      if (p.playerId && p.sessionToken) {
        persistCreator(created, {
          playerId: p.playerId,
          sessionToken: p.sessionToken,
          name: creatorNameSubmittedRef.current,
          avatarId: creatorAvatarSubmittedRef.current,
        });
        setPlayerId(p.playerId);
      }
      nav(`/room/${created}/host`, { replace: true });
    }
    function onRoomJoined(p) {
      if (p.role !== 'player' || !p.isCreator) return;
      setPlayerId(p.playerId);
      const c = codeRef.current;
      if (p.sessionToken && c) {
        persistCreator(c, {
          playerId: p.playerId,
          sessionToken: p.sessionToken,
          name: readCreatorSession(c)?.name ?? '',
        });
      }
    }
    function onErr(p) {
      const msg = p?.message ?? p?.code ?? 'Ошибка';
      setHostError(msg);
      setCreating(false);
    }
    function onStartFailed(p) {
      const map = {
        NOT_HOST: 'Только создатель может начать игру.',
        NEED_PLAYERS: 'Нужен хотя бы один игрок в комнате.',
        ROOM_NOT_FOUND: 'Комната не найдена на сервере.',
        BAD_DECK: 'Выбрана недоступная колода. Обновите страницу и попробуйте снова.',
      };
      setStartError(map[p?.code] ?? p?.message ?? p?.code ?? 'Не удалось начать игру');
    }

    function onSocketConnect() {
      if (codeParamRef.current === 'new' || !codeRef.current) return;
      const c = codeRef.current;
      const saved = readCreatorSession(c);
      socket.emit('host_rejoin', {
        code: normalizeRoomCode(c) || c,
        sessionToken: saved?.sessionToken ?? null,
      });
    }

    socket.on('room_update', onRoomUpdate);
    socket.on('game_update', onGameUpdate);
    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('error_msg', onErr);
    socket.on('start_game_failed', onStartFailed);
    socket.on('connect', onSocketConnect);

    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('game_update', onGameUpdate);
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('error_msg', onErr);
      socket.off('start_game_failed', onStartFailed);
      socket.off('connect', onSocketConnect);
    };
  }, [socket, nav, persistCreator]);

  useEffect(() => {
    if (codeParam === 'new') return;
    if (!code) return;
    const saved = readCreatorSession(code);
    socket.emit('host_rejoin', {
      code: normalizeRoomCode(code) || code,
      sessionToken: saved?.sessionToken ?? null,
    });
    if (saved?.playerId) setPlayerId(saved.playerId);
  }, [code, codeParam, socket]);

  function submitCreateRoom(e) {
    e.preventDefault();
    setHostError('');
    const name = creatorName.trim();
    if (!name) {
      setHostError('Введите имя');
      return;
    }
    setCreating(true);
    creatorNameSubmittedRef.current = name;
    creatorAvatarSubmittedRef.current = creatorAvatar;
    const saved = code ? readCreatorSession(code) : null;
    socket.emit('host_create_room', {
      creatorName: name,
      sessionToken: saved?.sessionToken ?? null,
      avatar: creatorAvatar,
    });
  }

  function openLaunchModal(nextType) {
    setStartError('');
    setSelectedDeckId(null);
    setLaunchGameType(nextType);
  }

  function confirmLaunchFromModal() {
    const c = normalizeRoomCode(code);
    if (!c || !launchGameType || !selectedDeckId) {
      setStartError('Некорректный код комнаты или не выбрана колода');
      return;
    }
    setStartError('');
    /** @type {Record<string, unknown>} */
    const options = { deckId: selectedDeckId };
    if (launchGameType === 'common_guess') {
      options.roundSeconds = 60;
      options.totalRounds = totalRounds;
    }
    socket.emit('start_game', {
      code: c,
      gameType: launchGameType,
      options,
    });
    setLaunchGameType(null);
    setSelectedDeckId(null);
  }

  const hasLiveGameState =
    gameState != null && typeof gameState.gameType === 'string';
  const inGame =
    room?.status === 'PLAYING' ||
    room?.status === 'RESULTS' ||
    roomStatus === 'PLAYING' ||
    roomStatus === 'RESULTS' ||
    hasLiveGameState;
  const gameType =
    room?.gameType ??
    (typeof gameState?.gameType === 'string' ? gameState.gameType : null);

  const creatorPlayerId = room?.creatorPlayerId ?? null;
  const myId = playerId ?? readCreatorSession(code)?.playerId ?? null;
  const canStart =
    Boolean(creatorPlayerId && myId && creatorPlayerId === myId) &&
    room?.status === 'LOBBY';

  const participants = room?.participants ?? [];

  useEffect(() => {
    if (inGame && launchGameType) {
      setLaunchGameType(null);
      setSelectedDeckId(null);
    }
  }, [inGame, launchGameType]);

  if (codeParam === 'new') {
    return (
      <div className="min-h-screen flex flex-col justify-center px-4 py-8">
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submitCreateRoom}
          className="max-w-md mx-auto w-full flex flex-col gap-4"
        >
          <h1 className="text-2xl font-bold text-center">Новая комната</h1>
          <p className="text-center text-slate-400 text-sm leading-relaxed">
            После ввода имени вы создадите комнату, к которой смогут подключиться
            игроки через QR или уникальный код
          </p>
          <label className="text-sm text-slate-500">Ваше имя</label>
          <input
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            placeholder="Как к вам обращаться"
            className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-4 text-lg"
            maxLength={32}
            required
            autoFocus
          />
          <AvatarPicker
            value={creatorAvatar}
            onChange={setCreatorAvatar}
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-4 text-lg font-semibold"
          >
            {creating ? 'Создаём…' : 'Создать комнату'}
          </button>
          {hostError && (
            <p className="text-red-400 text-sm text-center">{hostError}</p>
          )}
          <button
            type="button"
            onClick={() => nav('/')}
            className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 py-4 text-lg font-medium text-slate-200 hover:bg-slate-800"
          >
            На главную
          </button>
        </motion.form>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden p-4 sm:p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto w-full min-w-0 max-w-3xl"
      >
        {(hostError || startError || gameDecksError) && (
          <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-100 text-sm">
            {startError || hostError}
            {gameDecksError ? (
              <span className="block">
                Не удалось загрузить список колод: {gameDecksError}
              </span>
            ) : null}
          </div>
        )}
        {!inGame && (
          <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 w-full text-center sm:max-w-lg sm:text-left">
                <p className="text-slate-500 text-sm uppercase tracking-wider">
                  Комната
                </p>
                <p className="text-5xl font-black font-mono tracking-widest text-white">
                  {code}
                </p>
                {playUrl ? (
                  <button
                    type="button"
                    onClick={() => void copyRoomPlayLink()}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-950/50 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 mx-auto sm:mx-0"
                  >
                    {shareLinkCopied ? (
                      <>
                        <span aria-hidden>✓</span> Ссылка скопирована
                      </>
                    ) : (
                      'Поделиться комнатой'
                    )}
                  </button>
                ) : null}
                <JoinRoomHint className="mt-4 hidden text-sm leading-relaxed text-slate-400 sm:block" />
              </div>
              <div className="mx-auto flex shrink-0 flex-col items-center sm:mx-0 sm:items-end">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR-код: ссылка на комнату"
                    className="rounded-xl border border-slate-700"
                  />
                ) : (
                  <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-slate-900" />
                )}
              </div>
              <JoinRoomHint className="border-t border-slate-800/80 pt-5 text-sm leading-relaxed text-slate-400 sm:hidden" />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!inGame ? (
            <motion.section
              key="lobby"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-300">
                  Участники
                </h2>
                <ul className="space-y-2">
                  {participants.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-2 text-slate-200"
                    >
                      <PlayerAvatar
                        avatarId={p.avatar}
                        size="sm"
                        className={p.role === 'spectator' ? 'opacity-50' : ''}
                      />
                      <span>
                        {p.role === 'spectator'
                          ? 'Зритель'
                          : p.name || 'Игрок'}
                      </span>
                      {p.isCreator && (
                        <span className="rounded-md border border-violet-600/40 bg-violet-950/80 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
                          Создатель
                        </span>
                      )}
                      {p.role === 'spectator' && (
                        <span className="text-xs text-slate-500">
                          (только просмотр)
                        </span>
                      )}
                    </li>
                  ))}
                  {participants.length === 0 && (
                    <li className="text-slate-500">Загрузка списка…</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="mb-4 text-center text-sm uppercase tracking-wider text-slate-400">
                  Выберите игру
                </h3>
                <ul className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  {LOBBY_GAME_CARDS.map((card) => (
                    <li key={card.id} className="min-w-0 max-w-full">
                      <article className="flex h-full min-w-0 w-full max-w-full flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/40">
                        <div className="aspect-[16/10] bg-slate-950 border-b border-slate-800/80">
                          <img
                            src={card.image}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-6">
                          <h4 className="break-words text-xl font-semibold leading-snug text-white sm:text-2xl">
                            {card.title}
                          </h4>
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                            <p className="break-words text-sm leading-relaxed text-slate-400">
                              {card.description}
                            </p>
                            {card.funOfGame ? (
                              <div className="mt-3 border-t border-slate-800/70 pt-3">
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Фан игры
                                </p>
                                <p className="break-words text-sm leading-relaxed text-slate-400/95">
                                  {card.funOfGame}
                                </p>
                              </div>
                            ) : null}
                          </div>
                          {card.playable && card.gameType === 'common_guess' ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <button
                                type="button"
                                disabled={!canStart}
                                title={
                                  canStart
                                    ? undefined
                                    : 'Начать может только создатель комнаты в лобби'
                                }
                                onClick={() => openLaunchModal('common_guess')}
                                className="w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-lg font-bold"
                              >
                                Начать игру
                              </button>
                              <Link
                                to={gameRulesPath('common_guess')}
                                state={{ returnTo: rulesReturnTo }}
                                className="block w-full rounded-xl border border-fuchsia-500/45 bg-fuchsia-950/20 py-3 text-center text-lg font-bold text-fuchsia-200/95 hover:bg-fuchsia-950/40"
                              >
                                Подробные правила
                              </Link>
                            </div>
                          ) : card.playable && card.gameType === 'codenames' ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <button
                                type="button"
                                disabled={!canStart}
                                title={
                                  canStart
                                    ? undefined
                                    : 'Начать может только создатель комнаты в лобби'
                                }
                                onClick={() => openLaunchModal('codenames')}
                                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-lg font-bold"
                              >
                                Начать игру
                              </button>
                              <Link
                                to={gameRulesPath('codenames')}
                                state={{ returnTo: rulesReturnTo }}
                                className="block w-full rounded-xl border border-emerald-500/45 bg-emerald-950/20 py-3 text-center text-lg font-bold text-emerald-200/95 hover:bg-emerald-950/40"
                              >
                                Подробные правила
                              </Link>
                            </div>
                          ) : card.playable && card.gameType === 'never_have_i_ever' ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <button
                                type="button"
                                disabled={!canStart}
                                title={
                                  canStart
                                    ? undefined
                                    : 'Начать может только создатель комнаты в лобби'
                                }
                                onClick={() => openLaunchModal('never_have_i_ever')}
                                className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-lg font-bold"
                              >
                                Начать игру
                              </button>
                              <Link
                                to={gameRulesPath('never_have_i_ever')}
                                state={{ returnTo: rulesReturnTo }}
                                className="block w-full rounded-xl border border-rose-500/45 bg-rose-950/25 py-3 text-center text-lg font-bold text-rose-100/95 hover:bg-rose-950/45"
                              >
                                Подробные правила
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <motion.div
          key={inGame ? 'play' : 'idle'}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <GameContainer
            role="player"
            gameType={gameType}
            gameState={gameState}
            roomCode={code}
            socket={socket}
            playerId={myId}
            isCreator={Boolean(creatorPlayerId && myId && creatorPlayerId === myId)}
          />
        </motion.div>

        <GameLaunchModal
          open={launchGameType != null}
          gameType={launchGameType}
          decks={
            launchGameType
              ? gameDecksCatalog?.[launchGameType] ?? []
              : []
          }
          decksLoading={gameDecksLoading}
          selectedDeckId={selectedDeckId}
          onSelectDeck={setSelectedDeckId}
          totalRounds={totalRounds}
          onTotalRoundsChange={setTotalRounds}
          onCancel={() => {
            setLaunchGameType(null);
            setSelectedDeckId(null);
          }}
          onConfirm={confirmLaunchFromModal}
        />

        {!inGame && (
          <button
            type="button"
            onClick={() => nav('/')}
            className="mt-8 w-full rounded-xl border border-slate-600 bg-slate-900 py-4 text-lg font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            На главную
          </button>
        )}
      </motion.div>
    </div>
  );
}
