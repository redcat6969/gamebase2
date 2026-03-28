import { AnimatePresence, motion } from 'framer-motion';
import TVView from '../games/commonGuess/TVView.jsx';
import CommonGuessPlayer from '../games/commonGuess/CommonGuessPlayer.jsx';

const PLAYER_VIEWS = {
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
            <TVView state={gameState} roomCode={roomCode} socket={socket} />
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
          <Cmp
            state={gameState}
            roomCode={roomCode}
            socket={socket}
            playerId={playerId}
            isCreator={isCreator}
          />
        ) : (
          <p className="text-slate-400 text-center py-8">
            Ожидание выбора игры…
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
