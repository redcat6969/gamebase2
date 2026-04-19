import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { getSocket } from '../socket.js';
import GameContainer from '../components/GameContainer.jsx';
import GameStartSetupModal from '../components/GameStartSetupModal.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import { LOBBY_GAME_CARDS } from '../data/gamesCatalog.js';
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
  /** Настройки выбранной игры — только после «Начать игру» */
  const [gameSetupOpen, setGameSetupOpen] = useState(false);
  const creatorNameSubmittedRef = useRef('');
  const creatorAvatarSubmittedRef = useRef(DEFAULT_AVATAR_ID);
  const lastGamePayloadRef = useRef(null);
  const lastRoomRevRef = useRef(0);
  const codeRef = useRef(null);
  const codeParamRef = useRef(codeParam);

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

  useEffect(() => {
    if (!code || !playUrl) return;
    QRCode.toDataURL(playUrl, { margin: 1, width: 220 }).then(setQrDataUrl);
  }, [code, playUrl]);

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

  function confirmStartGameFromSetup() {
    const c = normalizeRoomCode(code);
    if (!c) {
      setStartError('Некорректный код комнаты');
      setGameSetupOpen(false);
      return;
    }
    setStartError('');
    socket.emit('start_game', {
      code: c,
      gameType: 'common_guess',
      options: {
        roundSeconds: 60,
        totalRounds,
      },
    });
    setGameSetupOpen(false);
  }

  function startCodenamesGame() {
    const c = normalizeRoomCode(code);
    if (!c) {
      setStartError('Некорректный код комнаты');
      return;
    }
    setStartError('');
    socket.emit('start_game', {
      code: c,
      gameType: 'codenames',
      options: {},
    });
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
    if (inGame && gameSetupOpen) setGameSetupOpen(false);
  }, [inGame, gameSetupOpen]);

  if (codeParam === 'new') {
    return (
      <div className="min-h-screen flex flex-col justify-center px-4 py-8">
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submitCreateRoom}
          className="max-w-md mx-auto w-full flex flex-col gap-4"
        >
          <button
            type="button"
            onClick={() => nav('/')}
            className="self-start inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <span aria-hidden>←</span>
            На главную
          </button>
          <h1 className="text-2xl font-bold text-center">Новая комната</h1>
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
        </motion.form>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto"
      >
        {!inGame && (
          <button
            type="button"
            onClick={() => nav('/')}
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <span aria-hidden>←</span>
            На главную
          </button>
        )}
        {(hostError || startError) && (
          <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-100 text-sm">
            {startError || hostError}
          </div>
        )}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-slate-500 text-sm uppercase tracking-wider">Комната</p>
            <p className="text-5xl font-black font-mono tracking-widest text-white">{code}</p>
          </div>
          {!inGame && (
            <div className="flex flex-col items-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR" className="rounded-xl border border-slate-700" />
              ) : (
                <div className="w-[220px] h-[220px] bg-slate-900 rounded-xl animate-pulse" />
              )}
              <p className="text-xs text-slate-500 mt-2 break-all max-w-[220px]">{playUrl}</p>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {!inGame ? (
            <motion.section
              key="lobby"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 mb-6"
            >
              <h2 className="text-lg font-semibold text-slate-300 mb-3">Участники</h2>
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
                      <span className="text-xs font-semibold uppercase tracking-wide text-violet-300 bg-violet-950/80 border border-violet-600/40 px-2 py-0.5 rounded-md">
                        Создатель
                      </span>
                    )}
                    {p.role === 'spectator' && (
                      <span className="text-xs text-slate-500">(только просмотр)</span>
                    )}
                  </li>
                ))}
                {participants.length === 0 && (
                  <li className="text-slate-500">Загрузка списка…</li>
                )}
              </ul>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <h3 className="text-center text-slate-400 text-sm mb-4 uppercase tracking-wider">
                  Выберите игру
                </h3>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {LOBBY_GAME_CARDS.map((card) => (
                    <li key={card.id}>
                      <article className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden flex flex-col h-full">
                        <div className="aspect-[16/10] bg-slate-950 border-b border-slate-800/80">
                          <img
                            src={card.image}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        </div>
                        <div className="p-4 flex flex-col gap-2 flex-1">
                          <h4 className="text-lg text-white leading-snug">
                            {card.title}
                          </h4>
                          <p className="text-sm text-slate-400 leading-relaxed flex-1">
                            {card.description}
                          </p>
                          {card.playable && card.gameType === 'common_guess' ? (
                            <button
                              type="button"
                              disabled={!canStart}
                              title={
                                canStart
                                  ? undefined
                                  : 'Начать может только создатель комнаты в лобби'
                              }
                              onClick={() => setGameSetupOpen(true)}
                              className="mt-2 w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-lg font-bold"
                            >
                              Начать игру
                            </button>
                          ) : card.playable && card.gameType === 'codenames' ? (
                            <button
                              type="button"
                              disabled={!canStart}
                              title={
                                canStart
                                  ? undefined
                                  : 'Начать может только создатель комнаты в лобби'
                              }
                              onClick={startCodenamesGame}
                              className="mt-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-lg font-bold"
                            >
                              Начать игру
                            </button>
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
            gameType={inGame ? gameType : null}
            gameState={gameState}
            roomCode={code}
            socket={socket}
            playerId={myId}
            isCreator={Boolean(creatorPlayerId && myId && creatorPlayerId === myId)}
          />
        </motion.div>

        <GameStartSetupModal
          open={gameSetupOpen}
          gameType="common_guess"
          totalRounds={totalRounds}
          onTotalRoundsChange={setTotalRounds}
          onCancel={() => setGameSetupOpen(false)}
          onConfirm={confirmStartGameFromSetup}
        />
      </motion.div>
    </div>
  );
}
