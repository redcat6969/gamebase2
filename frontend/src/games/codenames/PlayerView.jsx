import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import CodenamesSetupPanel from './CodenamesSetupPanel.jsx';
import CodenamesAnswerKeyGrid from './CodenamesAnswerKeyGrid.jsx';

function operativeCardClass(w) {
  if (w.isOpen) {
    if (w.color === 'red') return 'bg-red-900/85 border-red-600 text-red-50';
    if (w.color === 'blue') return 'bg-blue-900/85 border-blue-600 text-blue-50';
    if (w.color === 'assassin') return 'bg-slate-950 border-slate-900';
    return 'bg-amber-900/70 border-amber-700';
  }
  return 'bg-slate-700 border-slate-600 text-white';
}

function captainCardClass(w) {
  if (!w.isOpen) {
    if (w.color === 'red') return 'bg-red-950/40 border-red-700/80 text-white';
    if (w.color === 'blue') return 'bg-blue-950/40 border-blue-700/80 text-white';
    if (w.color === 'assassin') return 'bg-slate-900 border-slate-800';
    return 'bg-amber-950/40 border-amber-800/60 text-amber-50';
  }
  return operativeCardClass(w);
}

/** 4 цифры — как на сервере в RoomManager._normalizeCode */
function digitsRoomCode(roomCodeProp, stateRoomCode) {
  const fromState = String(stateRoomCode ?? '').replace(/\D/g, '').slice(0, 4);
  if (fromState.length === 4) return fromState;
  const fromProp = String(roomCodeProp ?? '').replace(/\D/g, '').slice(0, 4);
  return fromProp.length === 4 ? fromProp : '';
}

export default function PlayerView({ state, roomCode, socket, playerId }) {
  const [actionErr, setActionErr] = useState('');
  const [teamErr, setTeamErr] = useState('');
  const [hostErr, setHostErr] = useState('');

  useEffect(() => {
    function onPlayerActionFail(p) {
      const map = {
        NOT_YOUR_PLAYER: 'Сессия устарела — обновите страницу или войдите снова.',
        NO_GAME: 'Комната или игра недоступны.',
        SPECTATOR_CANNOT_PLAY: 'Зрители не могут выполнять действия.',
      };
      setActionErr(map[p?.code] ?? p?.code ?? 'Действие не выполнено');
    }
    function onHostActionFail(p) {
      const map = {
        NOT_HOST: 'Только устройство ведущего может завершить игру.',
      };
      setHostErr(map[p?.code] ?? p?.code ?? 'Действие недоступно');
    }
    socket.on('player_action_failed', onPlayerActionFail);
    socket.on('host_game_action_failed', onHostActionFail);
    return () => {
      socket.off('player_action_failed', onPlayerActionFail);
      socket.off('host_game_action_failed', onHostActionFail);
    };
  }, [socket]);

  if (!state || state.gameType !== 'codenames') return null;

  const myId = String(playerId ?? state.myId ?? '').trim();
  const phase = state.phase;
  const isCaptain = state.isCaptain;
  const myTeam = state.myTeam;
  const emitCode = digitsRoomCode(roomCode, state.roomCode);
  const showHostControls = Boolean(state.showHostControls);

  function resetToSetup() {
    setHostErr('');
    if (emitCode.length !== 4) return;
    socket.emit('host_game_action', {
      code: emitCode,
      action: { type: 'RESET_TO_SETUP' },
    });
  }

  function renderHostEndBar() {
    if (!showHostControls || (phase !== 'playing' && phase !== 'finished')) {
      return null;
    }
    return (
      <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 px-4 py-3 mb-4">
        <p className="text-amber-100/90 text-sm mb-2">
          Управление партией (экран ведущего)
        </p>
        <button
          type="button"
          onClick={resetToSetup}
          className="w-full rounded-xl border border-amber-600/60 bg-amber-900/50 hover:bg-amber-900/70 px-4 py-3 text-sm font-semibold text-amber-50"
        >
          Завершить игру — вернуться к назначению капитанов
        </button>
        {hostErr ? (
          <p className="text-red-400 text-xs mt-2 text-center">{hostErr}</p>
        ) : null}
      </div>
    );
  }

  if (phase === 'setup') {
    function join(team) {
      setTeamErr('');
      setActionErr('');
      if (!myId) {
        setTeamErr('Не удалось определить профиль — обновите страницу.');
        return;
      }
      if (emitCode.length !== 4) {
        setTeamErr('Некорректный код комнаты в адресе — проверьте ссылку.');
        return;
      }
      socket.emit('player_action', {
        code: emitCode,
        playerId: myId,
        action: { type: 'JOIN_TEAM', team },
      });
    }

    const captainWait = (
      <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-8 text-center">
        <p className="text-xl text-white font-semibold mb-2">
          Вы капитан команды{' '}
          {myTeam === 'red' ? 'красных 🔴' : 'синих 🔵'}
        </p>
        <p className="text-slate-400">
          Дождитесь, пока игроки выберут команды и ведущий начнёт игру.
        </p>
      </div>
    );

    const teamPick = (
      <div className="max-w-md mx-auto space-y-4">
        <p className="text-center text-slate-400 text-sm">Выберите команду</p>
        {(teamErr || actionErr) && (
          <p className="text-center text-red-400 text-sm rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2">
            {teamErr || actionErr}
          </p>
        )}
        <button
          type="button"
          onClick={() => join('red')}
          className="w-full rounded-2xl bg-red-900/70 hover:bg-red-800 border-2 border-red-600 py-8 text-xl font-bold text-white"
        >
          Войти в красную команду
        </button>
        <button
          type="button"
          onClick={() => join('blue')}
          className="w-full rounded-2xl bg-blue-900/70 hover:bg-blue-800 border-2 border-blue-600 py-8 text-xl font-bold text-white"
        >
          Войти в синюю команду
        </button>
      </div>
    );

    if (showHostControls) {
      return (
        <div className="space-y-8 max-w-xl mx-auto">
          <CodenamesSetupPanel state={state} roomCode={roomCode} socket={socket} />
          <div className="border-t border-slate-800 pt-8">
            <p className="text-center text-slate-500 text-xs uppercase tracking-wider mb-4">
              Ваша роль
            </p>
            {isCaptain ? captainWait : teamPick}
          </div>
        </div>
      );
    }

    if (isCaptain) return captainWait;
    return teamPick;
  }

  if (phase === 'finished') {
    const won = state.winner === myTeam;
    const finalWords = state.words ?? [];
    return (
      <div className="space-y-6">
        {renderHostEndBar()}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8 text-center">
          <p className="text-2xl font-bold text-white mb-2">
            {won ? 'Победа!' : 'Поражение'}
          </p>
          <p className="text-slate-400">
            Победила команда{' '}
            {state.winner === 'red' ? '🔴 красных' : '🔵 синих'}
          </p>
        </div>
        <CodenamesAnswerKeyGrid words={finalWords} />
      </div>
    );
  }

  const words = state.words ?? [];
  const votes = state.votes ?? {};
  const turn = state.turn ?? 'red';
  const myTurn = myTeam === turn;
  const operative = !isCaptain;

  let votedWordId = null;
  for (const [wid, ids] of Object.entries(votes)) {
    if (ids?.includes(myId)) votedWordId = wid;
  }

  function voteWord(wordId) {
    if (!operative || !myId || emitCode.length !== 4 || !myTurn) return;
    setActionErr('');
    socket.emit('player_action', {
      code: emitCode,
      playerId: myId,
      action: { type: 'VOTE_WORD', wordId },
    });
  }

  function revealWord(wordId) {
    if (!isCaptain || !myId || emitCode.length !== 4 || !myTurn) return;
    setActionErr('');
    socket.emit('player_action', {
      code: emitCode,
      playerId: myId,
      action: { type: 'REVEAL_WORD', wordId },
    });
  }

  function endTurn() {
    if (!isCaptain || !myId || emitCode.length !== 4 || !myTurn) return;
    setActionErr('');
    socket.emit('player_action', {
      code: emitCode,
      playerId: myId,
      action: { type: 'END_TURN' },
    });
  }

  return (
    <div className="space-y-4">
      {renderHostEndBar()}
      {actionErr ? (
        <p className="text-center text-red-400 text-sm rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2">
          {actionErr}
        </p>
      ) : null}
      <div className="text-center text-slate-300 text-sm">
        {isCaptain ? (
          <span>
            Капитан · ход{' '}
            <span className={turn === 'red' ? 'text-red-400' : 'text-blue-400'}>
              {turn === 'red' ? 'красных' : 'синих'}
            </span>
            {!myTurn && ' — ждите'}
          </span>
        ) : (
          <span>
            Оперативник · ход{' '}
            <span className={turn === 'red' ? 'text-red-400' : 'text-blue-400'}>
              {turn === 'red' ? 'красных' : 'синих'}
            </span>
            {!myTurn && ' — ждите'}
          </span>
        )}
      </div>
      {isCaptain && myTurn ? (
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={endTurn}
            className="w-full rounded-xl border border-slate-500 bg-slate-800/90 hover:bg-slate-700 py-3 text-sm font-semibold text-slate-100"
          >
            Завершить ход
          </button>
          <p className="text-center text-slate-500 text-xs mt-1.5">
            Ход перейдёт к другой команде
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-5 gap-2">
        {words.map((w) => {
          const n = votes[w.id]?.length ?? 0;
          const highlight =
            operative && votedWordId === w.id && !w.isOpen
              ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-950'
              : '';

          const cls = isCaptain ? captainCardClass(w) : operativeCardClass(w);

          return (
            <motion.button
              key={w.id}
              type="button"
              layout
              disabled={
                w.isOpen ||
                (operative && !myTurn) ||
                (isCaptain && !myTurn)
              }
              onClick={() => (isCaptain ? revealWord(w.id) : voteWord(w.id))}
              className={`relative aspect-[1.35] rounded-lg border-2 text-xs sm:text-sm font-bold leading-tight px-1 py-2 ${cls} ${highlight} disabled:opacity-40 disabled:pointer-events-none`}
              whileTap={{ scale: 0.97 }}
            >
              <span className="block">{w.text}</span>
              {n > 0 && !w.isOpen && (
                <span className="absolute top-0.5 right-0.5 min-w-[1.1rem] h-4 px-1 rounded-full bg-violet-600 text-[10px] text-white font-bold leading-4">
                  {n}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
