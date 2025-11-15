import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Timer.css';

function Timer({ endTime }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setTimeLeft(remaining);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 100);

    return () => clearInterval(interval);
  }, [endTime]);

  const formatTime = (ms) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimerClass = () => {
    const totalSeconds = timeLeft / 1000;
    if (totalSeconds <= 10) return 'critical';
    if (totalSeconds <= 30) return 'warning';
    return 'normal';
  };

  return (
    <div className={`timer ${getTimerClass()}`}>
      <div className="timer-icon">⏱️</div>
      <div className="timer-display">{formatTime(timeLeft)}</div>
    </div>
  );
}

Timer.propTypes = {
  endTime: PropTypes.number.isRequired,
};

export default Timer;
