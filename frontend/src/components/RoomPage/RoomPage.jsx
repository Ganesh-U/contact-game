import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../utils/api';
import PlayerSlot from './PlayerSlot';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import './RoomPage.css';

function RoomPage({ playerId, nickname, setNickname }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected, emit, on, off } = useSocket();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showTargetWordModal, setShowTargetWordModal] = useState(false);
  const [targetWord, setTargetWord] = useState('');
  const [wordType, setWordType] = useState('noun');
  const [localNickname, setLocalNickname] = useState(nickname);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [wordmasterChoosing, setWordmasterChoosing] = useState(false);
  const [choosingWordmasterName, setChoosingWordmasterName] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('lobby'); // 'lobby', 'settings', 'info'

  useEffect(() => {
    // Only load room if we have a playerId
    if (playerId) {
      loadRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]); // Added playerId as dependency

  useEffect(() => {
    if (!isConnected || !socket) return;

    emit('join_room', { roomId, playerId });
    emit('player_ready', { roomId, playerId });

    on('room_updated', handleRoomUpdate);
    on('game_started', handleGameStarted);
    on('player_left', handlePlayerLeft);
    on('player_kicked', handlePlayerKicked);
    on('error', handleSocketError);
    on('show_target_word_modal', handleShowTargetWordModal);
    on('wordmaster_choosing', handleWordmasterChoosing);
    on(
      'wordmaster_disconnected_during_setup',
      handleWordmasterDisconnectedDuringSetup
    );

    return () => {
      off('room_updated', handleRoomUpdate);
      off('game_started', handleGameStarted);
      off('player_left', handlePlayerLeft);
      off('player_kicked', handlePlayerKicked);
      off('error', handleSocketError);
      off('show_target_word_modal', handleShowTargetWordModal);
      off('wordmaster_choosing', handleWordmasterChoosing);
      off(
        'wordmaster_disconnected_during_setup',
        handleWordmasterDisconnectedDuringSetup
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, socket, roomId, playerId]);

  const loadRoom = async () => {
    // Safety check - don't load if no playerId
    if (!playerId) {
      return;
    }

    try {
      setLoading(true);

      const roomData = await api.getRoom(roomId);

      if (!roomData) {
        throw new Error('Room not found');
      }

      const playerInRoom = roomData.players.some(
        (p) => p.playerId === playerId
      );

      if (playerInRoom) {
        setRoom(roomData);
        setLoading(false);
        return;
      }

      if (!nickname) {
        setRoom(roomData);
        setShowNicknameModal(true);
        setLoading(false);
      } else {
        try {
          await api.addPlayer(roomId, playerId, nickname);
          const updatedRoom = await api.getRoom(roomId);
          setRoom(updatedRoom);
          setLoading(false);
        } catch (err) {
          console.error('Auto-join failed:', err);
          setRoom(roomData);
          setShowNicknameModal(true);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('loadRoom error:', err);
      setError(err.message || 'Failed to load room');
      setLoading(false);
    }
  };

  const handleJoinWithNickname = async () => {
    if (!localNickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    try {
      setNickname(localNickname.trim());
      await api.addPlayer(roomId, playerId, localNickname.trim());
      setShowNicknameModal(false);
      await loadRoom();
    } catch (err) {
      setError(err.message || 'Failed to join room');
    }
  };

  const handleRoomUpdate = (updatedRoom) => {
    setRoom(updatedRoom);

    if (updatedRoom.status === 'waiting') {
      setWordmasterChoosing(false);
      setChoosingWordmasterName('');
      setShowTargetWordModal(false);
    }
  };

  const handleGameStarted = () => {
    setWordmasterChoosing(false);
    navigate(`/game/${roomId}`);
  };

  const handlePlayerLeft = ({ nickname: leftPlayerNick }) => {
    if (wordmasterChoosing && choosingWordmasterName === leftPlayerNick) {
      setWordmasterChoosing(false);
      setChoosingWordmasterName('');
      setShowTargetWordModal(false);
    }

    setError(`${leftPlayerNick} disconnected from the room`);
    setTimeout(() => setError(''), 3000);

    loadRoom();
  };

  const handlePlayerKicked = ({
    playerId: kickedPlayerId,
    nickname: kickedNickname,
  }) => {
    if (kickedPlayerId === playerId) {
      alert('You were kicked from the room by the admin');
      navigate('/');
    } else {
      setError(`${kickedNickname} was kicked from the room`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSocketError = (errorData) => {
    setError(errorData.message || 'An error occurred');
  };

  const handleShowTargetWordModal = ({ wordmasterId }) => {
    if (wordmasterId === playerId) {
      setShowTargetWordModal(true);
    }
  };

  const handleWordmasterChoosing = ({ wordmasterId, wordmasterNickname }) => {
    if (wordmasterId !== playerId) {
      setChoosingWordmasterName(wordmasterNickname);
      setWordmasterChoosing(true);
    }
  };

  const handleWordmasterDisconnectedDuringSetup = ({ wordmasterNickname }) => {
    setWordmasterChoosing(false);
    setChoosingWordmasterName('');
    setShowTargetWordModal(false);
    setError(
      `Wordmaster ${wordmasterNickname} disconnected. Please select a new Wordmaster and try again.`
    );
    setTimeout(() => setError(''), 5000);
  };

  const handleRoleSelect = async (role) => {
    if (!room) return;

    const currentPlayer = room.players.find((p) => p.playerId === playerId);
    if (!currentPlayer) return;

    try {
      await api.updatePlayerRole(roomId, playerId, role);
    } catch (err) {
      console.error('Failed to update role:', err);
      setError('Failed to update role');
    }
  };

  const handleSettingsChange = async (field, value) => {
    if (!room || room.adminId !== playerId) return;

    const settings = {
      ...room.settings,
      [field]: parseInt(value),
    };

    try {
      await api.updateRoomSettings(roomId, playerId, settings);
    } catch (err) {
      console.error('Failed to update settings:', err);
      setError('Failed to update settings');
    }
  };

  const handleStartGame = async () => {
    if (!room || room.adminId !== playerId) return;

    const wordmaster = room.players.find((p) => p.role === 'wordmaster');
    const guessers = room.players.filter((p) => p.role === 'guesser');
    const unassignedPlayers = room.players.filter((p) => !p.role);

    if (unassignedPlayers.length > 0) {
      setError('All players must choose a role before starting');
      return;
    }

    if (!wordmaster) {
      setError('Need a Wordmaster to start the game');
      return;
    }

    if (guessers.length < 2) {
      setError('Need at least 2 Guessers to start the game');
      return;
    }

    const allPlayersReady = room.players.every((p) => p.isReady);
    if (!allPlayersReady) {
        setError('Waiting for all players to return to the lobby');
        return;
    }

    try {
      // Set status to 'starting' to trigger wordmaster choosing phase
      await api.updateRoomStatus(roomId, 'starting');
    } catch (err) {
      console.error('Failed to start game:', err);
      setError('Failed to start game');
    }
  };

  const handleSubmitTargetWord = async () => {
    if (!targetWord.trim() || targetWord.length < 5) {
      setError('Secret word must be at least 5 letters');
      return;
    }

    const wordmaster = room.players.find((p) => p.role === 'wordmaster');

    try {
      const wordmaster = room.players.find((p) => p.role === 'wordmaster');
      
      await api.createGame(
        roomId,
        wordmaster.playerId,
        targetWord.trim().toUpperCase(),
        wordType,
        room.players
      );
      
      setShowTargetWordModal(false);
    } catch (err) {
      console.error('Failed to create game:', err);
      setError(err.message || 'Failed to create game');
    }

    setShowTargetWordModal(false);
  };

  const handleLeaveRoom = async () => {
    try {
      // Socket disconnects automatically on unmount/navigate
      await api.removePlayer(roomId, playerId);
      navigate('/');
    } catch (err) {
      console.error('Error leaving room:', err);
      navigate('/');
    }
  };

  const handleKickPlayer = (playerIdToKick) => {
    try {
      api.removePlayer(roomId, playerIdToKick).catch(err => {
          console.error('Error kicking player:', err);
          setError('Failed to kick player');
      });
    } catch (err) {
        console.error('Error kicking player:', err);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="room-page">
        <div className="loading">Loading room...</div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="room-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = room && room.adminId === playerId;
  const currentPlayer = room?.players.find((p) => p.playerId === playerId);
  const wordmaster = room?.players.find((p) => p.role === 'wordmaster');
  const guessers = room?.players.filter((p) => p.role === 'guesser') || [];

  return (
    <div className="room-page">
      <div className="room-layout">
        {/* Mobile Nav for Room */}
        <div className="mobile-nav-tabs">
          <button 
            className={`mobile-nav-btn ${activeTab === 'lobby' ? 'active' : ''}`}
            onClick={() => setActiveTab('lobby')}
          >
            Lobby
          </button>
          <button 
            className={`mobile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          <button 
            className={`mobile-nav-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Info/Exit
          </button>
        </div>

        <aside 
          className={`left-sidebar ${activeTab === 'settings' ? 'mobile-visible' : ''}`}
          tabIndex={0}
          role="region"
          aria-label="Room Settings and Scoreboard"
        >
          <div className="room-settings">
            <h2>Room Settings</h2>

            <div className="setting-item">
              <label htmlFor="round-time">Round Time</label>
              <select
                id="round-time"
                value={room?.settings.roundTime || 2}
                onChange={(e) =>
                  handleSettingsChange('roundTime', e.target.value)
                }
                disabled={!isAdmin}
              >
                <option value="1">1 min</option>
                <option value="2">2 min</option>
                <option value="3">3 min</option>
                <option value="4">4 min</option>
                <option value="5">5 min</option>
              </select>
            </div>

            <div className="setting-item">
              <label htmlFor="wordmaster-guesses">Wordmaster Guesses</label>
              <select
                id="wordmaster-guesses"
                value={room?.settings.wordmasterGuesses || 3}
                onChange={(e) =>
                  handleSettingsChange('wordmasterGuesses', e.target.value)
                }
                disabled={!isAdmin}
              >
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
          </div>

          <div className="scoreboard-preview">
            <h2>Scoreboard</h2>
            <div className="player-list">
              {room?.players.map((player) => (
                <div key={player.playerId} className="score-item">
                  <span className="player-name">{player.nickname}</span>
                  <span className="player-role">
                    {player.role === 'wordmaster'
                      ? '👑'
                      : player.role === 'guesser'
                        ? '🎯'
                        : '⏳'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main 
          className={`room-main ${activeTab === 'lobby' ? 'mobile-visible' : ''}`}
          tabIndex={0}
          role="region"
          aria-label="Lobby Player Grid"
        >
          <div className="room-header">
            <h1>Game Lobby</h1>
            <p className="player-count">
              Players: {room?.players.length || 0}/6
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="players-grid">
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const player = room?.players[index];
              return (
                <PlayerSlot
                  key={index}
                  player={player}
                  isCurrentPlayer={player?.playerId === playerId}
                  onRoleSelect={handleRoleSelect}
                  canSelectRole={!!currentPlayer}
                  slotIndex={index}
                  allPlayers={room?.players || []}
                  isAdmin={isAdmin}
                  isRoomAdmin={room?.adminId === player?.playerId}
                  onKickPlayer={handleKickPlayer}
                />
              );
            })}
          </div>
        </main>

        <aside 
          className={`right-sidebar ${activeTab === 'info' ? 'mobile-visible' : ''}`}
          tabIndex={0}
          role="region"
          aria-label="Room Info and Actions"
        >
          <div className="room-info">
            <h2>Room ID</h2>
            <div className="room-code-container">
              <code className="room-code">{roomId}</code>
              <button className="copy-button" onClick={copyRoomCode}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>

          <div className="room-actions-sidebar">
            {isAdmin ? (
              <Button
                variant="primary"
                onClick={handleStartGame}
                disabled={
                  !wordmaster ||
                  guessers.length < 2 ||
                  room?.status === 'in-game' ||
                  !room?.players.every(p => p.isReady)
                }
                fullWidth
              >
                START GAME
              </Button>
            ) : (
              <p className="waiting-message">
                Waiting for admin to start the game...
              </p>
            )}

            <Button variant="secondary" onClick={handleLeaveRoom} fullWidth>
              LEAVE ROOM
            </Button>
          </div>

          <div className="game-log-preview">
            <h2>Game Log</h2>
            <div className="log-content">
              <p className="log-entry">Waiting for game to start...</p>
            </div>
          </div>
        </aside>
      </div>

      {wordmasterChoosing && (
        <div className="wordmaster-choosing-overlay">
          <div className="choosing-message">
            <div className="spinner"></div>
            <h3>{choosingWordmasterName} is choosing the secret word...</h3>
            <p>Game will start soon!</p>
          </div>
        </div>
      )}

      {showNicknameModal && (
        <Modal
          title="Enter Nickname"
          onClose={() => {
            setShowNicknameModal(false);
            navigate('/');
          }}
        >
          <div className="modal-content">
            <div className="input-group">
              <label htmlFor="nickname-input">Your Nickname</label>
              <input
                type="text"
                id="nickname-input"
                autoFocus
                className="input-field"
                placeholder="Enter nickname"
                value={localNickname}
                onChange={(e) => setLocalNickname(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleJoinWithNickname()
                }
                maxLength={20}
              />
            </div>

            <Button
              variant="primary"
              onClick={handleJoinWithNickname}
              disabled={!localNickname.trim()}
              fullWidth
            >
              JOIN ROOM
            </Button>
          </div>
        </Modal>
      )}

      {showTargetWordModal && (
        <Modal
          title="Choose Secret Word"
          onClose={() => setShowTargetWordModal(false)}
        >
          <div className="modal-content">
            <p className="modal-description">
              Choose a secret word (minimum 5 letters)
            </p>

            <div className="input-group">
              <label htmlFor="target-word">Secret Word</label>
              <input
                type="text"
                id="target-word"
                autoFocus
                className="input-field"
                placeholder="Enter secret word"
                value={targetWord}
                onChange={(e) => setTargetWord(e.target.value.toUpperCase())}
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleSubmitTargetWord()
                }
                maxLength={20}
              />
            </div>

            <div className="input-group">
              <label htmlFor="word-type">Word Type</label>
              <select
                id="word-type"
                className="input-field"
                value={wordType}
                onChange={(e) => setWordType(e.target.value)}
              >
                <option value="noun">Noun</option>
                <option value="verb">Verb</option>
                <option value="adjective">Adjective</option>
                <option value="other">Other</option>
              </select>
            </div>

            <Button
              variant="primary"
              onClick={handleSubmitTargetWord}
              disabled={!targetWord.trim() || targetWord.length < 5}
              fullWidth
            >
              START GAME
            </Button>
          </div>
        </Modal>
      )}

      {showRulesModal && (
        <Modal title="Game Rules" onClose={() => setShowRulesModal(false)}>
          <div className="rules-modal-content">
            <h4>How to Play Contact</h4>
            <ol>
              <li>One player is the Wordmaster, others are Guessers</li>
              <li>Wordmaster chooses a secret word</li>
              <li>First letter is revealed to Guessers</li>
              <li>Each round, one Guesser gives a clue</li>
              <li>Other Guessers try to match the clue word</li>
              <li>Wordmaster tries to block by guessing the clue word</li>
              <li>
                If contacts match and Wordmaster fails to block, next letter
                reveals
              </li>
              <li>First to guess the full secret word wins!</li>
            </ol>
          </div>
        </Modal>
      )}
    </div>
  );
}

RoomPage.propTypes = {
  playerId: PropTypes.string.isRequired,
  nickname: PropTypes.string.isRequired,
  setNickname: PropTypes.func.isRequired,
};

export default RoomPage;
