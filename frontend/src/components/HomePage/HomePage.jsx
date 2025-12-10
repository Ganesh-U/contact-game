import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { api } from '../../utils/api';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import './HomePage.css';

function HomePage({ playerId, nickname, setNickname }) {
  const navigate = useNavigate();
  const [localNickname, setLocalNickname] = useState(nickname);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!localNickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setNickname(localNickname.trim());
      const room = await api.createRoom(playerId, localNickname.trim());
      navigate(`/room/${room.roomId}`);
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!localNickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setNickname(localNickname.trim());
      const room = await api.getRoom(roomCode.trim().toUpperCase());

      if (!room) {
        throw new Error('Room not found');
      }

      await api.addPlayer(room.roomId, playerId, localNickname.trim());
      navigate(`/room/${room.roomId}`);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <section className="hero-section">
          <h1 className="title">CONTACT</h1>
          <p className="subtitle">Multiplayer Word Guessing Game</p>
        </section>

        <section
          className="rules-section"
          tabIndex={0}
          role="region"
          aria-label="Game Rules"
        >
          <h2>How to Play</h2>
          <div className="rules-content">
            <h3>Game Overview</h3>
            <p>
              Contact is a cooperative word-guessing game where guessers work
              together to reveal a secret word chosen by the Wordmaster.
            </p>

            <h3>Setup</h3>
            <ul>
              <li>3-6 players (1 Wordmaster + 2-5 Guessers)</li>
              <li>Wordmaster chooses a secret word (minimum 5 letters)</li>
              <li>First letter is revealed to Guessers</li>
            </ul>

            <h3>Gameplay</h3>
            <ol>
              <li>
                <strong>Clue-giver&apos;s Turn:</strong> Each round, one guesser
                becomes the clue-giver and thinks of a word starting with the
                revealed letters, then provides a clue.
              </li>
              <li>
                <strong>Making Contact:</strong> Other guessers who think they
                know the clue word enter their guess and click
                &quot;Contact!&quot;
              </li>
              <li>
                <strong>Wordmaster Blocks:</strong> The Wordmaster has limited
                time and guesses to block by guessing the clue word correctly.
              </li>
              <li>
                <strong>Successful Contact:</strong> If the Wordmaster fails to
                block and at least one guesser matches the clue word, the next
                letter of the secret word is revealed!
              </li>
              <li>
                <strong>Secret Word Guess:</strong> After each letter reveal,
                guessers can attempt to guess the full secret word (once per
                letter).
              </li>
              <li>
                <strong>Winning:</strong> First guesser to correctly guess the
                complete secret word wins!
              </li>
            </ol>

            <h3>Points System</h3>
            <ul>
              <li>
                Secret Word guess: 100 points
              </li>
              <li>
                Successful contact: 20 points to clue-giver, 15 points to matching guessers
              </li>
              <li>Wordmaster correct block: 10 points</li>
              <li>First to guess bonus: 25 points</li>
            </ul>
          </div>
        </section>

        <section className="actions-section">
          <div className="input-group">
            <label htmlFor="nickname">Enter Nickname</label>
            <input
              type="text"
              id="nickname"
              className="input-field"
              placeholder="Your nickname"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
              maxLength={20}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <Button
              variant="primary"
              onClick={handleCreateRoom}
              disabled={loading || !localNickname.trim()}
            >
              CREATE ROOM
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowJoinModal(true)}
              disabled={loading || !localNickname.trim()}
            >
              JOIN ROOM
            </Button>
          </div>
        </section>
      </div>

      {showJoinModal && (
        <Modal
          title="Join Room"
          onClose={() => {
            setShowJoinModal(false);
            setRoomCode('');
            setError('');
          }}
        >
          <div className="input-group">
            <label htmlFor="room-code">Room Code</label>
            <input
              type="text"
              id="room-code"
              autoFocus
              className="input-field"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              maxLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <Button
            variant="primary"
            onClick={handleJoinRoom}
            disabled={loading || !roomCode.trim()}
            fullWidth
          >
            {loading ? 'Joining...' : 'JOIN'}
          </Button>
        </Modal>
      )}
    </div>
  );
}

HomePage.propTypes = {
  playerId: PropTypes.string.isRequired,
  nickname: PropTypes.string.isRequired,
  setNickname: PropTypes.func.isRequired,
};

export default HomePage;
