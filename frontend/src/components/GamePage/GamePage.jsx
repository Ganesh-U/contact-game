import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../utils/api';
import Scoreboard from './Scoreboard';
import GameLog from './GameLog';
import Timer from './Timer';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import './GamePage.css';

function GamePage({ playerId }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected, emit, on, off } = useSocket();

  const [game, setGame] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [clueWord, setClueWord] = useState('');
  const [clue, setClue] = useState('');
  const [secondClue, setSecondClue] = useState('');

  const [contactWord, setContactWord] = useState('');
  const [hasClickedContact, setHasClickedContact] = useState(false);

  const [wordmasterGuess, setWordmasterGuess] = useState('');

  const [targetWordGuess, setTargetWordGuess] = useState('');
  const [canGuessTarget, setCanGuessTarget] = useState(true);

  const [roundEndTime, setRoundEndTime] = useState(null);
  const [halfRoundTime, setHalfRoundTime] = useState(null);
  const [canGiveSecondClue, setCanGiveSecondClue] = useState(false);

  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [roundTransitionData, setRoundTransitionData] = useState(null);
  const [transitionCountdown, setTransitionCountdown] = useState(20);
  const [showVictoryTransition, setShowVictoryTransition] = useState(false);
  const [victoryData, setVictoryData] = useState(null);

  useEffect(() => {
    loadGameAndRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!isConnected || !socket) return;

    emit('join_room', { roomId, playerId });

    on('clue_submitted', handleClueSubmitted);
    on('contact_updated', handleContactUpdated);
    on('wordmaster_guessed', handleWordmasterGuessed);
    on('round_timer_started', handleRoundTimerStarted);
    on('round_ended', handleRoundEnded);
    on('next_round_started', handleNextRoundStarted);
    on('target_word_guess_result', handleTargetWordGuessResult);
    on('game_completed', handleGameCompleted);
    on('player_disconnected_during_game', handlePlayerDisconnect);
    on('game_ended_disconnect', handleGameEndedDisconnect);
    on('error', handleSocketError);

    return () => {
      off('clue_submitted', handleClueSubmitted);
      off('contact_updated', handleContactUpdated);
      off('wordmaster_guessed', handleWordmasterGuessed);
      off('round_timer_started', handleRoundTimerStarted);
      off('round_ended', handleRoundEnded);
      off('next_round_started', handleNextRoundStarted);
      off('target_word_guess_result', handleTargetWordGuessResult);
      off('game_completed', handleGameCompleted);
      off('player_disconnected_during_game', handlePlayerDisconnect);
      off('game_ended_disconnect', handleGameEndedDisconnect);
      off('error', handleSocketError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, socket, roomId, playerId]);

  const handlePlayerDisconnect = ({
    game: updatedGame,
    disconnectedPlayer,
    wasClueGiver,
  }) => {
    setGame(updatedGame);
    if (wasClueGiver) {
      setError(
        `${disconnectedPlayer} (clue-giver) disconnected. Starting new round.`
      );
      resetRoundState();
    } else {
      setError(`${disconnectedPlayer} disconnected from the game.`);
    }
  };

  const handleGameEndedDisconnect = ({ reason, disconnectedPlayer }) => {
    alert(`Game ended: ${disconnectedPlayer} disconnected. ${reason}`);



    navigate(`/room/${roomId}`);
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error]);

  const closeRoundTransition = () => {
    setShowRoundTransition(false);
    setRoundTransitionData(null);
    resetRoundState();
  };

  useEffect(() => {
    if (showRoundTransition) {
      setTransitionCountdown(20);
      const interval = setInterval(() => {
        setTransitionCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            closeRoundTransition();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRoundTransition]);

  // Restore timer state if page is reloaded
  useEffect(() => {
    if (!game || !room) return;

    const currentRound = game.rounds[game.rounds.length - 1];

    // Check if we have an active round with a submitted clue (which starts the timer)
    if (
      currentRound &&
      currentRound.clueSubmittedAt &&
      !currentRound.roundEndedAt
    ) {
      const startTime = new Date(currentRound.clueSubmittedAt).getTime();
      const roundDuration = room.settings.roundTime * 60 * 1000;
      const endTime = startTime + roundDuration;
      const halfTime = startTime + roundDuration / 2;

      // Only act if the timer would still be running
      if (endTime > Date.now()) {
        // Only update if not already set (to avoid overriding socket-synced time with local calc)
        if (!roundEndTime) {
          setRoundEndTime(endTime);
          setHalfRoundTime(halfTime);
        }

        // Ensure second clue permission is correct based on restored time
        if (Date.now() >= halfTime && !canGiveSecondClue) {
          setCanGiveSecondClue(true);
        }
      }
    }
  }, [game, room, roundEndTime, canGiveSecondClue]);

  useEffect(() => {
    if (!halfRoundTime) return;

    const checkInterval = setInterval(() => {
      if (Date.now() >= halfRoundTime && !canGiveSecondClue) {
        setCanGiveSecondClue(true);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [halfRoundTime, canGiveSecondClue]);

  const loadGameAndRoom = async () => {
    try {
      setLoading(true);
      const [gameData, roomData] = await Promise.all([
        api.getActiveGame(roomId),
        api.getRoom(roomId),
      ]);

      if (!gameData) {
        throw new Error('No active game found');
      }

      setGame(gameData);
      setRoom(roomData);

      if (gameData.targetWordGuessAttempts[playerId]) {
        setCanGuessTarget(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load game');
    } finally {
      setLoading(false);
    }
  };

  const handleClueSubmitted = ({ game: updatedGame, isSecondClue }) => {
    setGame(updatedGame);
    if (!isSecondClue) {
      setClueWord('');
      setClue('');
    } else {
      setSecondClue('');
    }
  };

  const handleContactUpdated = ({ game: updatedGame }) => {
    setGame(updatedGame);
  };

  const handleWordmasterGuessed = ({ game: updatedGame, correct }) => {
    setGame(updatedGame);
    setWordmasterGuess('');

    if (correct) {
      setRoundEndTime(null);
      setHalfRoundTime(null);
      setCanGiveSecondClue(false);
      resetRoundState();
    }
  };

  const handleRoundTimerStarted = ({ duration, startTime }) => {
    const endTime = startTime + duration;
    const halfTime = startTime + duration / 2;
    setRoundEndTime(endTime);
    setHalfRoundTime(halfTime);
    setCanGiveSecondClue(false);
  };

  const handleRoundEnded = ({
    game: updatedGame,
    newLetter,
    contactSuccessful,
    clueWord,
    revealedWords,
  }) => {
    setGame(updatedGame);
    setRoundEndTime(null);
    setHalfRoundTime(null);
    setCanGiveSecondClue(false);

    if (newLetter) {
      setCanGuessTarget(true);
    }

    const nicknames = {};
    room?.players.forEach((p) => {
      nicknames[p.playerId] = p.nickname;
    });

    // Get the last log entry to show the actual reason
    const lastLog = updatedGame.gameLog[updatedGame.gameLog.length - 2]; // -2 because last is "Round ended"
    const failureReason =
      lastLog?.message ||
      'Contact guesses did not match or Wordmaster blocked successfully';

    setRoundTransitionData({
      contactSuccessful,
      clueWord,
      revealedWords,
      newLetter,
      playerNicknames: nicknames,
      failureReason,
    });
    setShowRoundTransition(true);
  };

  const handleNextRoundStarted = ({ game: updatedGame }) => {
    setGame(updatedGame);
    resetRoundState();
  };

  const handleTargetWordGuessResult = ({ correct, game: updatedGame }) => {
    if (!correct) {
      setError('Incorrect secret word guess');
      setGame(updatedGame);
    }
    setTargetWordGuess('');
  };

  const handleGameCompleted = ({ game: updatedGame, winnerId }) => {
    setGame(updatedGame);

    if (winnerId) {
      // Someone won - show victory transition first
      const winner = room?.players.find((p) => p.playerId === winnerId);
      const winnerNickname = winner?.nickname || 'Unknown';
      const winnerScore = updatedGame.scores[winnerId] || 0;

      setVictoryData({
        winnerNickname,
        winnerScore,
        secretWord: updatedGame.targetWord,
        isYou: winnerId === playerId,
      });
      setShowVictoryTransition(true);

      // Show game over modal after 8 seconds
      setTimeout(() => {
        setShowVictoryTransition(false);
        setShowGameOverModal(true);
      }, 8000);
    } else {
      // No winner (all letters revealed) - go straight to game over
      setShowGameOverModal(true);
    }
  };

  const handleSocketError = (errorData) => {
    setError(errorData.message || 'An error occurred');
  };

  const resetRoundState = () => {
    setClueWord('');
    setClue('');
    setSecondClue('');
    setContactWord('');
    setHasClickedContact(false);
    setWordmasterGuess('');
  };

  const handleSubmitClue = () => {
    if (!clueWord.trim() || !clue.trim()) {
      setError('Please enter both clue word and clue');
      return;
    }

    const revealedStr = game.revealedLetters.join('');
    if (!clueWord.toUpperCase().startsWith(revealedStr)) {
      setError(`Clue word must start with "${revealedStr}"`);
      return;
    }

    const currentRound = game.rounds[game.rounds.length - 1];

    emit('submit_clue', {
      gameId: game.gameId,
      roomId,
      roundNumber: currentRound.roundNumber,
      clueWord: clueWord.trim(),
      clue: clue.trim(),
      isSecondClue: false,
    });
  };

  const handleSubmitSecondClue = () => {
    if (!secondClue.trim()) {
      setError('Please enter a second clue');
      return;
    }

    const currentRound = game.rounds[game.rounds.length - 1];

    emit('submit_clue', {
      gameId: game.gameId,
      roomId,
      roundNumber: currentRound.roundNumber,
      clueWord: null,
      clue: secondClue.trim(),
      isSecondClue: true,
    });
  };

  const handleContactClick = () => {
    if (!contactWord.trim()) {
      setError('Please enter a word before clicking Contact');
      return;
    }

    const currentRound = game.rounds[game.rounds.length - 1];

    emit('contact_click', {
      gameId: game.gameId,
      roomId,
      roundNumber: currentRound.roundNumber,
      playerId,
      word: contactWord.trim(),
    });

    setHasClickedContact(true);
  };

  const handleUpdateContact = () => {
    if (!contactWord.trim()) return;

    const currentRound = game.rounds[game.rounds.length - 1];

    emit('update_contact', {
      gameId: game.gameId,
      roomId,
      roundNumber: currentRound.roundNumber,
      playerId,
      word: contactWord.trim(),
    });
  };

  const handleRemoveContact = () => {
    const currentRound = game.rounds[game.rounds.length - 1];

    emit('remove_contact', {
      gameId: game.gameId,
      roomId,
      roundNumber: currentRound.roundNumber,
      playerId,
    });

    setContactWord('');
    setHasClickedContact(false);
  };

  const handleWordmasterGuessSubmit = () => {
    if (!wordmasterGuess.trim()) {
      setError('Please enter a guess');
      return;
    }

    const currentRound = game.rounds[game.rounds.length - 1];

    emit('wordmaster_guess', {
      gameId: game.gameId,
      roomId,
      roundNumber: currentRound.roundNumber,
      guess: wordmasterGuess.trim(),
    });
  };

  const handleTargetWordGuessSubmit = () => {
    if (!targetWordGuess.trim()) {
      setError('Please enter a guess');
      return;
    }

    if (!canGuessTarget) {
      setError('You already used your guess for this letter');
      return;
    }

    emit('target_word_guess', {
      gameId: game.gameId,
      roomId,
      playerId,
      guess: targetWordGuess.trim(),
    });

    setCanGuessTarget(false);
  };

  const handleBackToRoom = async () => {
    try {
      // Update room status back to waiting
      await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/rooms/${roomId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'waiting' }),
        }
      );

      // Navigate back to room
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error('Error returning to room:', error);
      // Navigate anyway
      navigate(`/room/${roomId}`);
    }
  };

  if (loading) {
    return (
      <div className="game-page">
        <div className="loading">Loading game...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="game-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <Button
            variant="secondary"
            onClick={() => navigate(`/room/${roomId}`)}
          >
            Back to Room
          </Button>
        </div>
      </div>
    );
  }

  const isWordmaster = game.wordmasterId === playerId;
  const currentRound = game.rounds[game.rounds.length - 1];
  const isClueGiver = currentRound?.clueGiverId === playerId;
  const hasClueBeenSubmitted = currentRound?.clueWord !== null;
  const playerNicknames = {};
  room?.players.forEach((p) => {
    playerNicknames[p.playerId] = p.nickname;
  });

  return (
    <div className="game-page">
      <div className="game-layout">
        <aside className="left-sidebar">
          <div className="room-settings-display">
            <h3>Settings</h3>
            <p>Round Time: {room?.settings.roundTime} min</p>
            <p>WM Guesses: {room?.settings.wordmasterGuesses}</p>
          </div>

          <Scoreboard
            players={room?.players || []}
            scores={game?.scores || {}}
            wordmasterId={game?.wordmasterId}
            currentClueGiverId={currentRound?.clueGiverId}
          />
        </aside>

        <main className="game-main">
          <div className="game-header">
            <div className="target-word-display">
              {isWordmaster ? (
                <div className="wordmaster-view">
                  <p className="label-text">Secret Word (only you can see)</p>
                  <h2 className="target-word">{game.targetWord}</h2>
                  <div className="revealed-progress">
                    <span className="revealed-letters-display">
                      Revealed: {game.revealedLetters.join('')}
                    </span>
                    <span className="dash">
                      {Array(
                        game.targetWord.length - game.revealedLetters.length
                      )
                        .fill('_')
                        .join(' ')}
                    </span>
                  </div>
                  <p className="word-length">
                    {game.targetWord.length} letters - {game.wordType}
                  </p>
                </div>
              ) : (
                <div className="guesser-view">
                  <p className="label-text">Secret Word</p>
                  <h2 className="revealed-letters">
                    {game.revealedLetters.map((letter, i) => (
                      <span key={i} className="letter">
                        {letter}
                      </span>
                    ))}
                    {Array(game.targetWord.length - game.revealedLetters.length)
                      .fill('_')
                      .map((dash, i) => (
                        <span key={i} className="dash">
                          {dash}
                        </span>
                      ))}
                  </h2>
                  <p className="word-length">
                    {game.targetWord.length} letters - {game.wordType}
                  </p>
                </div>
              )}
            </div>

            {roundEndTime && <Timer endTime={roundEndTime} />}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="game-content">
            {isWordmaster && (
              <div className="wordmaster-panel">
                <h3>Wordmaster Controls</h3>

                {!hasClueBeenSubmitted ? (
                  <div className="waiting-state">
                    <p>
                      Waiting for {playerNicknames[currentRound?.clueGiverId]}{' '}
                      to give a clue...
                    </p>
                  </div>
                ) : (
                  <div className="wordmaster-guess-panel">
                    <div className="clue-display">
                      <h4>Current Clue</h4>
                      <p className="clue-text">
                        &quot;{currentRound.clue}&quot; (clue word starts with{' '}
                        {game.revealedLetters.join('')})
                      </p>
                      {currentRound.secondClue && (
                        <p className="clue-text secondary">
                          Second Clue: &quot;{currentRound.secondClue}&quot;
                        </p>
                      )}
                    </div>

                    <div className="guess-input">
                      <label>Guess the Clue Word</label>
                      <div className="input-row">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Enter your guess"
                          value={wordmasterGuess}
                          onChange={(e) =>
                            setWordmasterGuess(e.target.value.toUpperCase())
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' && handleWordmasterGuessSubmit()
                          }
                          maxLength={20}
                        />
                        <Button
                          variant="primary"
                          onClick={handleWordmasterGuessSubmit}
                          disabled={
                            !wordmasterGuess.trim() ||
                            currentRound.wordmasterGuessesRemaining <= 0
                          }
                        >
                          Guess ({currentRound.wordmasterGuessesRemaining} left)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isWordmaster && isClueGiver && (
              <div className="clue-giver-panel">
                <h3>Your Turn - Give a Clue</h3>

                {!hasClueBeenSubmitted ? (
                  <div className="clue-input-form">
                    <div className="input-group">
                      <label>
                        Clue Word (starts with {game.revealedLetters.join('')})
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Hidden from others"
                        value={clueWord}
                        onChange={(e) =>
                          setClueWord(e.target.value.toUpperCase())
                        }
                        onKeyPress={(e) =>
                          e.key === 'Enter' && handleSubmitClue()
                        }
                        maxLength={20}
                      />
                    </div>

                    <div className="input-group">
                      <label>Your Clue (visible to all)</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Give a hint for your word"
                        value={clue}
                        onChange={(e) => setClue(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === 'Enter' && handleSubmitClue()
                        }
                        maxLength={100}
                      />
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleSubmitClue}
                      disabled={!clueWord.trim() || !clue.trim()}
                      fullWidth
                    >
                      Submit Clue
                    </Button>
                  </div>
                ) : (
                  <div className="clue-submitted-view">
                    <div className="clue-display">
                      <p>
                        <strong>Your Clue Word:</strong> {currentRound.clueWord}
                      </p>
                      <p>
                        <strong>Your Clue:</strong> {currentRound.clue}
                      </p>
                      {currentRound.secondClue && (
                        <p>
                          <strong>Second Clue:</strong>{' '}
                          {currentRound.secondClue}
                        </p>
                      )}
                    </div>

                    {canGiveSecondClue && !currentRound.secondClue && (
                      <div className="second-clue-input">
                        <label>Give a Second Clue (Optional)</label>
                        <div className="input-row">
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Additional hint"
                            value={secondClue}
                            onChange={(e) => setSecondClue(e.target.value)}
                            maxLength={100}
                          />
                          <Button
                            variant="secondary"
                            onClick={handleSubmitSecondClue}
                            disabled={!secondClue.trim()}
                          >
                            Submit
                          </Button>
                        </div>
                      </div>
                    )}

                    <p className="info-text">
                      Waiting for contacts and wordmaster guesses...
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isWordmaster && !isClueGiver && (
              <div className="guesser-panel">
                {!hasClueBeenSubmitted ? (
                  <div className="waiting-state">
                    <p>
                      {playerNicknames[currentRound?.clueGiverId]} is giving a
                      clue...
                    </p>
                  </div>
                ) : (
                  <div className="contact-panel">
                    <div className="clue-display">
                      <h4>Clue</h4>
                      <p className="clue-text">
                        &quot;{currentRound.clue}&quot; (clue word starts with{' '}
                        {game.revealedLetters.join('')})
                      </p>
                      {currentRound.secondClue && (
                        <p className="clue-text secondary">
                          Second Clue: &quot;{currentRound.secondClue}&quot;
                        </p>
                      )}
                    </div>

                    <div className="contact-input">
                      <label>Think you know the word?</label>
                      <div className="input-row">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Enter your guess"
                          value={contactWord}
                          onChange={(e) =>
                            setContactWord(e.target.value.toUpperCase())
                          }
                          onKeyPress={(e) =>
                            e.key === 'Enter' &&
                            !hasClickedContact &&
                            handleContactClick()
                          }
                          maxLength={20}
                        />
                        {!hasClickedContact ? (
                          <Button
                            variant="primary"
                            onClick={handleContactClick}
                            disabled={!contactWord.trim()}
                          >
                            CONTACT!
                          </Button>
                        ) : (
                          <div className="contact-actions">
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={handleUpdateContact}
                              disabled={!contactWord.trim()}
                            >
                              Update
                            </Button>
                            <Button
                              variant="danger"
                              size="small"
                              onClick={handleRemoveContact}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                      {hasClickedContact && (
                        <p className="success-text">Contact submitted! ✓</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isWordmaster && hasClueBeenSubmitted && (
              <div className="target-guess-panel">
                <h4>Guess the Secret Word</h4>
                <div className="input-row">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter full secret word"
                    value={targetWordGuess}
                    onChange={(e) =>
                      setTargetWordGuess(e.target.value.toUpperCase())
                    }
                    onKeyPress={(e) =>
                      e.key === 'Enter' && handleTargetWordGuessSubmit()
                    }
                    maxLength={20}
                  />
                  <Button
                    variant="success"
                    onClick={handleTargetWordGuessSubmit}
                    disabled={!targetWordGuess.trim() || !canGuessTarget}
                  >
                    Guess Secret Word
                  </Button>
                </div>
                {!canGuessTarget && (
                  <p className="info-text">
                    Wait for next letter to guess again
                  </p>
                )}
              </div>
            )}
          </div>
        </main>

        <aside className="right-sidebar">
          <div className="room-info-sidebar">
            <h3>Room Info</h3>
            <p>
              <strong>Room:</strong> {roomId}
            </p>
            <p>
              <strong>Round:</strong> {game.currentRound}
            </p>
          </div>

          <GameLog
            gameLog={game?.gameLog || []}
            playerNicknames={playerNicknames}
          />
        </aside>
      </div>

      {showVictoryTransition && victoryData && (
        <div className="victory-transition-overlay">
          <div className="victory-content">
            <div className="victory-icon">🎉</div>
            <h1 className="victory-title">
              {victoryData.isYou
                ? 'YOU WON!'
                : `${victoryData.winnerNickname} WINS!`}
            </h1>
            <div className="victory-details">
              <p className="secret-word-reveal">
                Secret word was: <strong>{victoryData.secretWord}</strong>
              </p>
              <p className="winner-score">
                Final Score: <strong>{victoryData.winnerScore} points</strong>
              </p>
            </div>
            {victoryData.isYou && (
              <p className="victory-message">Congratulations! 🎊</p>
            )}
          </div>
        </div>
      )}

      {showRoundTransition && roundTransitionData && (
        <div className="round-transition-overlay">
          <div className="transition-content">
            <h2>Round Ended!</h2>

            <div className="transition-timer">
              <p>Next round starts in: <strong>{transitionCountdown}s</strong></p>
              <Button 
                variant="secondary" 
                size="small" 
                onClick={closeRoundTransition}
                className="skip-button"
              >
                Skip Wait
              </Button>
            </div>

            <div className="reveal-section">
              <h3>Clue Word Reveal</h3>
              <p className="clue-word-reveal">
                Clue word was: <strong>{roundTransitionData.clueWord}</strong>
              </p>

              <div className="guesses-reveal">
                {roundTransitionData.revealedWords.map((item, index) => (
                  <p key={index} className="guess-reveal">
                    {roundTransitionData.playerNicknames[item.playerId] ||
                      'Player'}{' '}
                    guessed: <strong>{item.word}</strong>
                  </p>
                ))}
              </div>
            </div>

            {roundTransitionData.contactSuccessful ? (
              <div className="contact-result success">
                <h3>✅ Successful Contact!</h3>
                <p className="letter-reveal">
                  Next letter revealed:{' '}
                  <strong>{roundTransitionData.newLetter}</strong>
                </p>
              </div>
            ) : (
              <div className="contact-result failed">
                <h3>❌ Contact Failed</h3>
                <p>{roundTransitionData.failureReason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showGameOverModal && (
        <Modal
          title="Game Over!"
          onClose={() => setShowGameOverModal(false)}
          size="large"
        >
          <div className="game-over-content">
            <h2>Final Scores</h2>
            <div className="final-scoreboard">
              {room?.players
                .map((p) => ({
                  ...p,
                  score: game.scores[p.playerId] || 0,
                }))
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div key={player.playerId} className="final-score-item">
                    <span className="rank">#{index + 1}</span>
                    <span className="player-name">{player.nickname}</span>
                    <span className="score">{player.score} pts</span>
                    {index === 0 && (
                      <span className="winner-badge">👑 Winner!</span>
                    )}
                  </div>
                ))}
            </div>

            <div className="game-over-actions">
              <Button variant="primary" onClick={handleBackToRoom}>
                Back to Room
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

GamePage.propTypes = {
  playerId: PropTypes.string.isRequired,
};

export default GamePage;
