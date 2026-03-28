import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { getSocket } from '../socket.js';
import GameContainer from '../components/GameContainer.jsx';
import GameStartSetupModal from '../components/GameStartSetupModal.jsx';

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
  const [playerId, setPlayerId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [totalRounds, setTotalRounds] = useState(3);
  /** Настройки выбранной игры — только после «Начать игру» */
  const [gameSetupOpen, setGameSetupOpen] = useState(false);
  const creatorNameSubmittedRef = useRef('');

  const code =
    codeParam === 'new' ? null : normalizeRoomCode(codeParam) || codeParam;

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
      setRoom(p);
      setRoomStatus(p?.status ?? null);
      setHostError('');
      if (p?.status === 'PLAYING' || p?.status === 'RESULTS') setStartError('');
    }
    function onGameUpdate(p) {
      setGameState(p?.state ?? null);
      if (p?.roomStatus) setRoomStatus(p.roomStatus);
    }
    function onRoomCreated(p) {
      const created = p.code;
      setCreating(false);
      if (p.playerId && p.sessionToken) {
        persistCreator(created, {
          playerId: p.playerId,
          sessionToken: p.sessionToken,
          name: creatorNameSubmittedRef.current,
        });
        setPlayerId(p.playerId);
      }
      nav(`/room/${created}/host`, { replace: true });
    }
    function onRoomJoined(p) {
      if (p.role !== 'player' || !p.isCreator) return;
      setPlayerId(p.playerId);
      if (p.sessionToken && code) {
        persistCreator(code, {
          playerId: p.playerId,
          sessionToken: p.sessionToken,
          name: readCreatorSession(code)?.name ?? '',
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

    socket.on('room_update', onRoomUpdate);
    socket.on('game_update', onGameUpdate);
    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('error_msg', onErr);
    socket.on('start_game_failed', onStartFailed);

    if (codeParam === 'new') {
      // комната создаётся после ввода имени (форма ниже)
    } else if (code) {
      const saved = readCreatorSession(code);
      socket.emit('host_rejoin', {
        code: normalizeRoomCode(code) || code,
        sessionToken: saved?.sessionToken ?? null,
      });
      if (saved?.playerId) setPlayerId(saved.playerId);
    }

    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('game_update', onGameUpdate);
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('error_msg', onErr);
      socket.off('start_game_failed', onStartFailed);
    };
  }, [code, codeParam, nav, socket, persistCreator]);

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
    const saved = code ? readCreatorSession(code) : null;
    socket.emit('host_create_room', {
      creatorName: name,
      sessionToken: saved?.sessionToken ?? null,
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

  const inGame = roomStatus === 'PLAYING' || roomStatus === 'RESULTS';
  const gameType = room?.gameType ?? (inGame ? 'common_guess' : null);

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

              {canStart && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setGameSetupOpen(true)}
                    className="w-full rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 py-4 text-xl font-bold"
                  >
                    Начать игру
                  </button>
                </div>
              )}
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
