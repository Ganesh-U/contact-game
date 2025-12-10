import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './GameLog.css';

function GameLog({ gameLog }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameLog]);

  const formatLogMessage = (logEntry) => {
    // The message already has player nicknames from backend
    return logEntry.message;
  };

  const getLogEntryClass = (event) => {
    if (
      event.includes('success') ||
      event.includes('correct') ||
      event.includes('completed')
    ) {
      return 'success';
    }
    if (
      event.includes('failed') ||
      event.includes('incorrect') ||
      event.includes('ended')
    ) {
      return 'error';
    }
    if (
      event.includes('started') ||
      event.includes('contact_clicked') ||
      event.includes('clue')
    ) {
      return 'info';
    }
    return 'default';
  };

  return (
    <div className="game-log">
      <h3 className="game-log-title">Game Log</h3>
      <div className="game-log-content">
        {gameLog.length === 0 ? (
          <p className="empty-log">No events yet...</p>
        ) : (
          <>
            {gameLog.map((entry, index) => (
              <div
                key={index}
                className={`log-entry ${getLogEntryClass(entry.event)}`}
              >
                <span className="log-time">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="log-message">{formatLogMessage(entry)}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </>
        )}
      </div>
    </div>
  );
}

GameLog.propTypes = {
  gameLog: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.instanceOf(Date),
      ]).isRequired,
      event: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default GameLog;
