import { useState } from 'react';
import PropTypes from 'prop-types';
import './PlayerSlot.css';

function PlayerSlot({
  player,
  isCurrentPlayer,
  onRoleSelect,
  canSelectRole,
  slotIndex,
  allPlayers,
  isAdmin,
  onKickPlayer,
}) {
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  //   const isWordmasterSlot = slotIndex === 0;
  const wordmasterTaken = allPlayers?.some((p) => p && p.role === 'wordmaster');

  if (!player) {
    return (
      <div className="player-slot empty">
        <div className="slot-content">
          <span className="slot-label">
            {slotIndex === 0 ? 'Wordmaster Slot' : `Guesser Slot ${slotIndex}`}
          </span>
        </div>
      </div>
    );
  }

  const handleSelectRole = (role) => {
    if (isCurrentPlayer && canSelectRole) {
      onRoleSelect(role);
    }
  };

  const handleKickClick = (e) => {
    e.stopPropagation();
    setShowKickConfirm(true);
  };

  const handleKickConfirm = (e) => {
    e.stopPropagation();
    if (onKickPlayer) {
      onKickPlayer(player.playerId);
    }
    setShowKickConfirm(false);
  };

  const handleKickCancel = (e) => {
    e.stopPropagation();
    setShowKickConfirm(false);
  };

  return (
    <div
      className={`player-slot ${player.role || 'no-role'} ${
        isCurrentPlayer ? 'current-player' : ''
      }`}
    >
      <div className="slot-content">
        <div className="player-info">
          <span className="player-nickname">{player.nickname}</span>
          {isCurrentPlayer && <span className="you-badge">YOU</span>}
        </div>

        {player.role === 'wordmaster' && (
          <div className="role-badge wordmaster">
            <span className="role-icon">👑</span>
            <span className="role-name">Wordmaster</span>
          </div>
        )}

        {player.role === 'guesser' && (
          <div className="role-badge guesser">
            <span className="role-icon">🎯</span>
            <span className="role-name">Guesser</span>
          </div>
        )}

        {!player.role && isCurrentPlayer && canSelectRole && (
          <div className="role-selector">
            <button
              className="role-button wordmaster-btn"
              onClick={() => handleSelectRole('wordmaster')}
              disabled={wordmasterTaken}
            >
              👑 Wordmaster
            </button>
            <button
              className="role-button guesser-btn"
              onClick={() => handleSelectRole('guesser')}
            >
              🎯 Guesser
            </button>
            {wordmasterTaken && (
              <p className="role-hint-text">Wordmaster already taken</p>
            )}
          </div>
        )}

        {!player.role && !isCurrentPlayer && (
          <div className="waiting-role">
            <span>Choosing role...</span>
          </div>
        )}

        {player.role && isCurrentPlayer && canSelectRole && (
          <button
            className="leave-slot-btn"
            onClick={() => handleSelectRole(null)}
          >
            Switch Role
          </button>
        )}

        {isAdmin && !isCurrentPlayer && !showKickConfirm && (
          <button className="kick-player-btn" onClick={handleKickClick}>
            ✕ Kick
          </button>
        )}

        {isAdmin && !isCurrentPlayer && showKickConfirm && (
          <div className="kick-confirm">
            <p className="kick-confirm-text">Kick {player.nickname}?</p>
            <div className="kick-confirm-buttons">
              <button className="kick-confirm-yes" onClick={handleKickConfirm}>
                Yes
              </button>
              <button className="kick-confirm-no" onClick={handleKickCancel}>
                No
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

PlayerSlot.propTypes = {
  player: PropTypes.shape({
    playerId: PropTypes.string.isRequired,
    nickname: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['wordmaster', 'guesser', null]),
    isReady: PropTypes.bool,
    joinedAt: PropTypes.string,
  }),
  isCurrentPlayer: PropTypes.bool.isRequired,
  onRoleSelect: PropTypes.func.isRequired,
  canSelectRole: PropTypes.bool.isRequired,
  slotIndex: PropTypes.number.isRequired,
  allPlayers: PropTypes.array,
  isAdmin: PropTypes.bool,
  onKickPlayer: PropTypes.func,
};

export default PlayerSlot;
