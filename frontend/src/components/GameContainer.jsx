import TVView from '../games/commonGuess/TVView.jsx';
import CodenamesHostView from '../games/codenames/HostView.jsx';
import CodenamesPlayerView from '../games/codenames/PlayerView.jsx';
import CommonGuessPlayer from '../games/commonGuess/CommonGuessPlayer.jsx';
import NeverHaveIEverHostView from '../games/neverHaveIEver/HostView.jsx';
import NeverHaveIEverPlayerView from '../games/neverHaveIEver/PlayerView.jsx';

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

/** У игроков и ведущего всегда интерфейс с голосованием; HostView только у зрителей в ветке spectator. */
function NeverHaveIEverShell({ state, roomCode, socket, playerId, isCreator }) {
  const s = state;
  if (!s || s.gameType !== 'never_have_i_ever') {
    return (
      <p className="text-slate-400 text-center py-12">Загрузка состояния игры…</p>
    );
  }
  return (
    <NeverHaveIEverPlayerView
      state={s}
      roomCode={roomCode}
      socket={socket}
      playerId={playerId}
      isCreator={isCreator}
    />
  );
}

const PLAYER_VIEWS = {
  codenames: CodenamesShell,
  common_guess: CommonGuessPlayer,
  never_have_i_ever: NeverHaveIEverShell,
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
  /** Строго: иначе {} или снимок другой игры проходят в чужой вид → пустой экран */
  const stateMatchesGame =
    Boolean(gameType) &&
    Boolean(gameState) &&
    typeof gameState.gameType === 'string' &&
    gameState.gameType === gameType;

  if (role === 'spectator') {
    return (
      <div key={gameType ?? 'tv'} className="min-h-[50vh]">
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
          ) : gameType === 'never_have_i_ever' ? (
            <NeverHaveIEverHostView
              state={gameState}
              roomCode={roomCode}
              socket={socket}
              readOnly={true}
            />
          ) : (
            <TVView state={gameState} roomCode={roomCode} socket={socket} />
          )
        ) : (
          <p className="text-slate-400 text-center py-8">
            Ожидание начала игры…
          </p>
        )}
      </div>
    );
  }

  const Cmp = gameType ? PLAYER_VIEWS[gameType] : null;

  return (
    <div key={gameType ?? 'lobby'} className="min-h-[50vh]">
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
    </div>
  );
}
