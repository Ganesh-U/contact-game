import PropTypes from 'prop-types';
import './Scoreboard.css';

function Scoreboard({ players, scores, wordmasterId, currentClueGiverId }) {
  // Sort by score descending
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = scores[a.playerId] || 0;
    const scoreB = scores[b.playerId] || 0;
    return scoreB - scoreA;
  });

  return (
    <div className="scoreboard">
      <h3 className="scoreboard-title">Scoreboard</h3>
      <div className="scoreboard-list">
        {sortedPlayers.map((player, index) => {
          const isWordmaster = player.playerId === wordmasterId;
          const isClueGiver = player.playerId === currentClueGiverId;
          const score = scores[player.playerId] || 0;

          return (
            <div
              key={player.playerId}
              className={`scoreboard-item ${
                isWordmaster ? 'wordmaster-item' : ''
              } ${isClueGiver ? 'clue-giver-item' : ''}`}
            >
              <span className="player-rank">#{index + 1}</span>
              <div className="player-info">
                <span className="player-nickname">{player.nickname}</span>
                <div className="player-roles">
                  {isWordmaster && (
                    <span className="role-label wordmaster-label">
                      Wordmaster
                    </span>
                  )}
                  {isClueGiver && (
                    <span className="role-label clue-giver-label">
                      Clue Giver
                    </span>
                  )}
                </div>
              </div>
              <span className="player-score">{score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Scoreboard.propTypes = {
  players: PropTypes.arrayOf(
    PropTypes.shape({
      playerId: PropTypes.string.isRequired,
      nickname: PropTypes.string.isRequired,
      role: PropTypes.string,
    })
  ).isRequired,
  scores: PropTypes.objectOf(PropTypes.number).isRequired,
  wordmasterId: PropTypes.string.isRequired,
  currentClueGiverId: PropTypes.string,
};

export default Scoreboard;
