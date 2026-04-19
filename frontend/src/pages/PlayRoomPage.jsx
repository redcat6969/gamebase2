import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { motion } from 'framer-motion';
import { getSocket } from '../socket.js';
import GameContainer from '../components/GameContainer.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import { DEFAULT_AVATAR_ID } from '../data/avatarOptions.js';

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

/** 4 цифры кода для URL страницы комнаты с игрой (/room/:code/host) */
function normalizeRoomCodeForRoute(raw) {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 4);
  return d.length === 4 ? d : '';
}

/** Код комнаты из URL или из снимка комнаты с сервера */
function resolveRoomRouteCode(urlCode, room) {
  return (
    normalizeRoomCodeForRoute(urlCode) ||
    normalizeRoomCodeForRoute(room?.code != null ? String(room.code) : '')
  );
}

export default function PlayRoomPage() {
  const { code } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const [socket] = useState(() => getSocket());
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const nameRef = useRef('');
  const avatarRef = useRef(DEFAULT_AVATAR_ID);
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
  /** Последнее состояние из game_update */
  const lastGamePayloadRef = useRef(null);
  /** rev из room_update — отбрасываем только более старые снимки (не от LOBBY при раннем порядке пакетов) */
  const lastRoomRevRef = useRef(0);
  const codeRef = useRef(code);
  const locationRef = useRef(location);
  const roomRef = useRef(room);
  const gameStateRef = useRef(gameState);
  const roomStatusRef = useRef(roomStatus);
  const joinedRef = useRef(joined);
  const roleRef = useRef(role);
  const resyncAttemptsRef = useRef(0);
  codeRef.current = code;
  locationRef.current = location;
  roomRef.current = room;
  gameStateRef.current = gameState;
  roomStatusRef.current = roomStatus;
  joinedRef.current = joined;
  roleRef.current = role;

  const [joinedAtMs, setJoinedAtMs] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useLayoutEffect(() => {
    setSpectatorEntryPending(location.state?.joinAsSpectator === true);
  }, [location.key]);

  useEffect(() => {
    if (prevCodeRef.current !== code) {
      prevCodeRef.current = code;
      spectatorFromHomeEmitted.current = false;
      lastRoomRevRef.current = 0;
      resyncAttemptsRef.current = 0;
    }
  }, [code]);

  useEffect(() => {
    if (joined) {
      setJoinedAtMs(Date.now());
    } else {
      setJoinedAtMs(null);
    }
  }, [joined, code]);

  useEffect(() => {
    if (!joined) return;
    const t = setInterval(() => setNowTick(Date.now()), 2000);
    return () => clearInterval(t);
  }, [joined]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    avatarRef.current = avatarId;
  }, [avatarId]);

  useEffect(() => {
    const saved = readSession(code);
    if (saved?.name && saved?.sessionToken && saved?.role !== 'spectator') {
      setName(saved.name);
      if (saved.avatarId) setAvatarId(saved.avatarId);
    }
  }, [code]);

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
    function onJoined(p) {
      setRole(p.role);
      setPlayerId(p.playerId);
      setJoined(true);
      const sessionCode = codeRef.current;
      if (p.role === 'spectator') {
        setSpectatorEntryPending(false);
        sessionStorage.setItem(
          storageKeySession(sessionCode),
          JSON.stringify({
            role: 'spectator',
            sessionToken: p.sessionToken,
          })
        );
        nav(locationRef.current.pathname, { replace: true, state: {} });
        return;
      }
      sessionStorage.setItem(
        storageKeySession(sessionCode),
        JSON.stringify({
          playerId: p.playerId,
          name: nameRef.current.trim(),
          avatarId: avatarRef.current,
          sessionToken: p.sessionToken,
          role: 'player',
        })
      );
    }
    function onFail(p) {
      setSpectatorEntryPending(false);
      setJoinError(p?.code ?? 'JOIN_FAILED');
    }

    /** После reconnect socket.id меняется; сервер удалил старый socket из комнаты — без повторного join игрок не получает game_update */
    function rejoinAfterReconnect() {
      const c = codeRef.current;
      const data = readSession(c);
      if (data?.sessionToken && data.role === 'spectator') {
        socket.emit('join_room', {
          code: c,
          role: 'spectator',
          sessionToken: data.sessionToken,
        });
        return;
      }
      if (data?.sessionToken && data?.name) {
        socket.emit('join_room', {
          code: c,
          name: data.name,
          sessionToken: data.sessionToken,
          avatar: data.avatarId ?? DEFAULT_AVATAR_ID,
        });
      }
    }

    socket.on('room_update', onRoomUpdate);
    socket.on('game_update', onGameUpdate);
    socket.on('room_joined', onJoined);
    socket.on('join_room_failed', onFail);
    socket.on('connect', rejoinAfterReconnect);

    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('game_update', onGameUpdate);
      socket.off('room_joined', onJoined);
      socket.off('join_room_failed', onFail);
      socket.off('connect', rejoinAfterReconnect);
    };
  }, [socket, nav]);

  useEffect(() => {
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
        avatar: data.avatarId ?? DEFAULT_AVATAR_ID,
      });
    }
  }, [code, socket, spectatorEntryPending]);

  const emitSessionResync = useCallback(() => {
    const c = codeRef.current;
    const data = readSession(c);
    if (data?.sessionToken && data.role === 'spectator') {
      socket.emit('join_room', {
        code: c,
        role: 'spectator',
        sessionToken: data.sessionToken,
      });
      return;
    }
    if (data?.sessionToken && data?.name) {
      socket.emit('join_room', {
        code: c,
        name: data.name,
        sessionToken: data.sessionToken,
        avatar: data.avatarId ?? DEFAULT_AVATAR_ID,
      });
    }
  }, [socket]);

  /** Автопереподключение: тот же join_room, что при обновлении страницы */
  useEffect(() => {
    const id = setInterval(() => {
      if (!joinedRef.current) return;
      const data = readSession(codeRef.current);
      if (!data?.sessionToken) return;

      const r = roomRef.current;
      const gs = gameStateRef.current;
      const rss = roomStatusRef.current;
      const roleHere = roleRef.current;
      const age =
        joinedAtMs != null ? Date.now() - joinedAtMs : 0;

      const playingWithoutGame =
        (r?.status === 'PLAYING' || rss === 'PLAYING') && gs == null;
      const noRoomTooLong = r == null && age > 2800;
      const lobbyEmptyTooLong =
        r?.status === 'LOBBY' &&
        gs == null &&
        age > 4500 &&
        (!Array.isArray(r?.participants) || r.participants.length === 0);

      const spectatorStuck =
        roleHere === 'spectator' &&
        (r?.status === 'PLAYING' || rss === 'PLAYING') &&
        gs == null &&
        age > 3500;

      const need =
        playingWithoutGame ||
        noRoomTooLong ||
        lobbyEmptyTooLong ||
        spectatorStuck;

      if (!need) {
        resyncAttemptsRef.current = 0;
        return;
      }
      if (resyncAttemptsRef.current >= 14) return;
      resyncAttemptsRef.current += 1;
      emitSessionResync();
    }, 3500);
    return () => clearInterval(id);
  }, [emitSessionResync, joinedAtMs]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== 'visible') return;
      if (!joinedRef.current) return;
      const data = readSession(codeRef.current);
      if (!data?.sessionToken) return;
      emitSessionResync();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [emitSessionResync]);

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
      avatar: avatarId,
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

  /** Снимок комнаты может не прийти (socket не в io room), а game_update — да */
  const hasLiveGameState =
    gameState != null && typeof gameState.gameType === 'string';
  const matchActive =
    room?.status === 'PLAYING' ||
    room?.status === 'RESULTS' ||
    roomStatus === 'PLAYING' ||
    roomStatus === 'RESULTS' ||
    hasLiveGameState;

  const gameType =
    room?.gameType ??
    (typeof gameState?.gameType === 'string' ? gameState.gameType : null);
  const isMeCreator =
    Boolean(
      room?.creatorPlayerId &&
        playerId &&
        room.creatorPlayerId === playerId
    );

  const msSinceJoin =
    joinedAtMs != null ? nowTick - joinedAtMs : 0;
  const showResyncUi =
    joined &&
    msSinceJoin > 4000 &&
    (role === 'spectator'
      ? (room?.status === 'PLAYING' || roomStatus === 'PLAYING') &&
        gameState == null
      : ((room?.status === 'PLAYING' || roomStatus === 'PLAYING') &&
          gameState == null) ||
        room == null ||
        (room?.status === 'LOBBY' &&
          gameState == null &&
          (!room?.participants || room.participants.length === 0)));

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
          <button
            type="button"
            onClick={() => nav('/')}
            className="self-start inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <span aria-hidden>←</span>
            На главную
          </button>
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
            <AvatarPicker value={avatarId} onChange={setAvatarId} />
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

  const routeCode = resolveRoomRouteCode(code, room);
  const hostLobbyPath =
    routeCode.length === 4 ? `/room/${routeCode}/host` : null;
  const showLobbyBack =
    joined &&
    hostLobbyPath &&
    !matchActive &&
    isMeCreator;

  if (role === 'spectator') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        {showLobbyBack ? (
          <button
            type="button"
            onClick={() => nav(hostLobbyPath)}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <span aria-hidden>←</span>
            К экрану комнаты со списком игр
          </button>
        ) : null}
        <p className="text-center text-slate-500 text-sm mb-6">Трансляция · {code}</p>
        {showResyncUi ? (
          <div className="max-w-md mx-auto mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => emitSessionResync()}
              className="text-sm text-violet-300 underline-offset-2 hover:underline"
            >
              Нет картинки? Синхронизировать
            </button>
          </div>
        ) : null}
        <GameContainer
          role="spectator"
          gameType={matchActive ? gameType : null}
          gameState={gameState}
          roomCode={routeCode.length === 4 ? routeCode : code}
          socket={socket}
          playerId={null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-10">
      {showLobbyBack ? (
        <div className="max-w-xl mx-auto mb-4">
          <button
            type="button"
            onClick={() => nav(hostLobbyPath)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <span aria-hidden>←</span>
            К экрану комнаты со списком игр
          </button>
        </div>
      ) : null}
      <p className="flex items-center justify-center gap-2 text-center text-slate-500 text-sm mb-4">
        <PlayerAvatar
          avatarId={
            gameState?.myAvatar ?? readSession(code)?.avatarId ?? avatarId
          }
          size="sm"
        />
        <span>
          {name} · {code}
        </span>
      </p>
      {showResyncUi ? (
        <div className="max-w-xl mx-auto mb-3 flex justify-center">
          <button
            type="button"
            onClick={() => emitSessionResync()}
            className="text-sm text-violet-300 underline-offset-2 hover:underline"
          >
            Не видите игру или лобби? Синхронизировать
          </button>
        </div>
      ) : null}
      <GameContainer
        role="player"
        gameType={matchActive ? gameType : null}
        gameState={gameState}
        roomCode={routeCode.length === 4 ? routeCode : code}
        socket={socket}
        playerId={playerId ?? readSession(code)?.playerId ?? null}
        isCreator={isMeCreator}
      />
    </div>
  );
}
