import { AnimatePresence, motion } from 'framer-motion';
import TVView from '../games/commonGuess/TVView.jsx';
import CodenamesHostView from '../games/codenames/HostView.jsx';
import CodenamesPlayerView from '../games/codenames/PlayerView.jsx';
import CommonGuessPlayer from '../games/commonGuess/CommonGuessPlayer.jsx';

function CodenamesShell({ state, roomCode, socket, playerId }) {
  const s = state;
  if (!s || s.gameType !== 'codenames') {
    return (
      <p className="text-slate-400 text-center py-12">Загрузка состояния игры…</p>
    );
  }
  /** Все игроки (включая ведущего) получают состояние игрока; общий экран только у зрителей */
  return (
    <CodenamesPlayerView
      state={s}
      roomCode={roomCode}
      socket={socket}
      playerId={playerId}
    />
  );
}

const PLAYER_VIEWS = {
  codenames: CodenamesShell,
  common_guess: CommonGuessPlayer,
};

/**
 * @param {{
 *   role: 'player' | 'spectator',
 *   gameType: string | null,
 *   gameState: object | null,
 *   roomCode: string,
 *   socket: import('socket.io-client').Socket,
 *   playerId?: string | null,
 *   isCreator?: boolean,
 * }}
 */
export default function GameContainer({
  role,
  gameType,
  gameState,
  roomCode,
  socket,
  playerId,
  isCreator = false,
}) {
  const stateMatchesGame =
    !gameType ||
    !gameState ||
    typeof gameState.gameType !== 'string' ||
    gameState.gameType === gameType;

  if (role === 'spectator') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={gameType ?? 'tv'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="min-h-[50vh]"
        >
          {gameType ? (
            gameState == null || !stateMatchesGame ? (
              <p className="text-slate-400 text-center py-12">
                Загрузка состояния игры…
              </p>
            ) : gameType === 'codenames' ? (
              <CodenamesHostView
                state={gameState}
                roomCode={roomCode}
                socket={socket}
                readOnly
              />
            ) : (
              <TVView state={gameState} roomCode={roomCode} socket={socket} />
            )
          ) : (
            <p className="text-slate-400 text-center py-8">
              Ожидание начала игры…
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  const Cmp = gameType ? PLAYER_VIEWS[gameType] : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameType ?? 'lobby'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="min-h-[50vh]"
      >
        {Cmp ? (
          gameState == null || !stateMatchesGame ? (
            <p className="text-slate-400 text-center py-12">
              Загрузка состояния игры…
            </p>
          ) : (
            <Cmp
              state={gameState}
              roomCode={roomCode}
              socket={socket}
              playerId={playerId}
              isCreator={isCreator}
            />
          )
        ) : (
          <p className="text-slate-400 text-center py-8">
            Ожидание выбора игры…
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
