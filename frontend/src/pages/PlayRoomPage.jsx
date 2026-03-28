import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { getSocket } from '../socket.js';
import GameContainer from '../components/GameContainer.jsx';

/** sessionStorage — отдельно на каждую вкладку */
function storageKeySession(code) {
  return `gamebase_session_${code}`;
}

function readSession(code) {
  try {
    const raw = sessionStorage.getItem(storageKeySession(code));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function PlayRoomPage() {
  const { code } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const [socket] = useState(() => getSocket());
  const [name, setName] = useState('');
  const nameRef = useRef('');
  const [joined, setJoined] = useState(false);
  const [role, setRole] = useState(/** @type {'player' | 'spectator' | null} */ (null));
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [spectatorEntryPending, setSpectatorEntryPending] = useState(false);
  const spectatorFromHomeEmitted = useRef(false);
  const prevCodeRef = useRef(code);

  useLayoutEffect(() => {
    setSpectatorEntryPending(location.state?.joinAsSpectator === true);
  }, [location.key]);

  useEffect(() => {
    if (prevCodeRef.current !== code) {
      prevCodeRef.current = code;
      spectatorFromHomeEmitted.current = false;
    }
  }, [code]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    const saved = readSession(code);
    if (saved?.name && saved?.sessionToken && saved?.role !== 'spectator') {
      setName(saved.name);
    }
  }, [code]);

  useEffect(() => {
    function onRoomUpdate(p) {
      setRoom(p);
      setRoomStatus(p?.status ?? null);
    }
    function onGameUpdate(p) {
      setGameState(p?.state ?? null);
      if (p?.roomStatus) setRoomStatus(p.roomStatus);
    }
    function onJoined(p) {
      setRole(p.role);
      setPlayerId(p.playerId);
      setJoined(true);
      if (p.role === 'spectator') {
        setSpectatorEntryPending(false);
        sessionStorage.setItem(
          storageKeySession(code),
          JSON.stringify({
            role: 'spectator',
            sessionToken: p.sessionToken,
          })
        );
        nav(location.pathname, { replace: true, state: {} });
        return;
      }
      sessionStorage.setItem(
        storageKeySession(code),
        JSON.stringify({
          name: nameRef.current.trim(),
          sessionToken: p.sessionToken,
          role: 'player',
        })
      );
    }
    function onFail(p) {
      setSpectatorEntryPending(false);
      setJoinError(p?.code ?? 'JOIN_FAILED');
    }

    socket.on('room_update', onRoomUpdate);
    socket.on('game_update', onGameUpdate);
    socket.on('room_joined', onJoined);
    socket.on('join_room_failed', onFail);

    const data = readSession(code);
    if (data?.sessionToken && data.role === 'spectator') {
      socket.emit('join_room', {
        code,
        role: 'spectator',
        sessionToken: data.sessionToken,
      });
    } else if (spectatorEntryPending && !spectatorFromHomeEmitted.current) {
      spectatorFromHomeEmitted.current = true;
      socket.emit('join_room', {
        code,
        role: 'spectator',
      });
    } else if (data?.sessionToken && data?.name) {
      socket.emit('join_room', {
        code,
        name: data.name,
        sessionToken: data.sessionToken,
      });
    }

    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('game_update', onGameUpdate);
      socket.off('room_joined', onJoined);
      socket.off('join_room_failed', onFail);
    };
  }, [code, socket, spectatorEntryPending, location.pathname, nav]);

  function submitJoin(e) {
    e.preventDefault();
    setJoinError('');
    const trimmed = name.trim();
    const data = readSession(code);
    const token =
      data?.sessionToken &&
      data?.name &&
      data.name.trim().toLowerCase() === trimmed.toLowerCase()
        ? data.sessionToken
        : null;
    socket.emit('join_room', {
      code,
      name: trimmed,
      sessionToken: token || null,
    });
  }

  function joinAsSpectator() {
    setJoinError('');
    socket.emit('join_room', {
      code,
      role: 'spectator',
    });
  }

  const inGame = roomStatus === 'PLAYING' || roomStatus === 'RESULTS';
  const gameType = room?.gameType ?? (inGame ? 'common_guess' : null);
  const isMeCreator =
    Boolean(
      room?.creatorPlayerId &&
        playerId &&
        room.creatorPlayerId === playerId
    );

  if (!joined) {
    if (spectatorEntryPending) {
      return (
        <div className="min-h-screen flex flex-col justify-center px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto w-full flex flex-col gap-4 text-center"
          >
            <h1 className="text-2xl font-bold">Комната {code}</h1>
            <p className="text-slate-400">Подключаемся как зритель…</p>
            <p className="text-slate-600 text-sm">
              Откроется общий экран игры
            </p>
            {joinError && (
              <p className="text-red-400 text-sm">{joinError}</p>
            )}
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto w-full flex flex-col gap-4"
        >
          <h1 className="text-2xl font-bold text-center">Комната {code}</h1>
          <form onSubmit={submitJoin} className="flex flex-col gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Твоё имя"
              className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-4 text-lg"
              maxLength={32}
              required
            />
            <button
              type="submit"
              className="rounded-xl bg-violet-600 py-4 text-lg font-semibold"
            >
              Войти как игрок
            </button>
          </form>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-slate-950 px-2 text-slate-600">или</span>
            </div>
          </div>
          <button
            type="button"
            onClick={joinAsSpectator}
            className="rounded-xl border border-slate-600 bg-slate-900 hover:bg-slate-800 py-4 text-lg font-medium text-slate-200"
          >
            Войти как зритель
          </button>
          <p className="text-xs text-slate-600 text-center -mt-2">
            Общий экран игры (как на ТВ)
          </p>
          {joinError && (
            <p className="text-red-400 text-sm text-center">{joinError}</p>
          )}
        </motion.div>
      </div>
    );
  }

  if (role === 'spectator') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <p className="text-center text-slate-500 text-sm mb-6">Трансляция · {code}</p>
        <GameContainer
          role="spectator"
          gameType={inGame ? gameType : null}
          gameState={gameState}
          roomCode={code}
          socket={socket}
          playerId={null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-10">
      <p className="text-center text-slate-500 text-sm mb-4">
        {name} · {code}
      </p>
      <GameContainer
        role="player"
        gameType={inGame ? gameType : null}
        gameState={gameState}
        roomCode={code}
        socket={socket}
        playerId={playerId}
        isCreator={isMeCreator}
      />
    </div>
  );
}
