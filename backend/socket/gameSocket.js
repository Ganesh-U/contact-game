import { Server } from 'socket.io';
import { Room } from '../models/Room.js';
import { Game } from '../models/Game.js';
import {
  calculateTargetWordPoints,
  getContactSuccessPoints,
  getWordmasterBlockPoints,
  checkContactMatch,
  getNextRevealedLetter,
  checkTargetWordGuess,
  checkClueWordGuess,
  getFirstToGuessBonus,
} from '../utils/gameLogic.js';

export function initializeGameSocket(server, sessionMiddleware) {
  const io = new Server(server);

  // Convert Express session middleware to Socket.io middleware
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  // Store active timers, player connections, and disconnect timers
  const roundTimers = new Map();
  const playerSockets = new Map(); // playerId -> socketId
  const disconnectTimers = new Map(); // playerId -> timeout

  io.on('connection', (socket) => {
    // Check if user has existing session
    const session = socket.request.session;
    if (session && session.playerId && session.roomId) {
      // Restore player state from session
      socket.playerId = session.playerId;
      socket.roomId = session.roomId;
      socket.nickname = session.nickname;

      // Auto-rejoin room if it still exists
      Room.findByRoomId(session.roomId)
        .then((room) => {
          if (room) {
            socket.join(session.roomId);
            playerSockets.set(session.playerId, socket.id);

            // Cancel any pending disconnect timer
            if (disconnectTimers.has(session.playerId)) {
              clearTimeout(disconnectTimers.get(session.playerId));
              disconnectTimers.delete(session.playerId);
            }

            // Notify room of reconnection
            io.to(session.roomId).emit('player_reconnected', {
              playerId: session.playerId,
              nickname: session.nickname,
            });
          } else {
            // Room no longer exists, clear session
            session.playerId = null;
            session.roomId = null;
            session.nickname = null;
            session.save();
          }
        })
        .catch((err) => {
          console.error('Error checking room on reconnect:', err);
        });
    }

    // Join room
    socket.on('join_room', async ({ roomId, playerId, nickname }) => {
      try {
        socket.join(roomId);

        // Store player info in socket
        socket.playerId = playerId;
        socket.roomId = roomId;
        socket.nickname = nickname;

        // Store player info in session
        const session = socket.request.session;
        session.playerId = playerId;
        session.roomId = roomId;
        session.nickname = nickname;
        session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
          }
        });

        // Track this player's connection
        playerSockets.set(playerId, socket.id);

        // Cancel any pending disconnect timer for this player
        if (disconnectTimers.has(playerId)) {
          clearTimeout(disconnectTimers.get(playerId));
          disconnectTimers.delete(playerId);
        }

        const room = await Room.findByRoomId(roomId);
        if (room) {
          io.to(roomId).emit('room_updated', room);
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Player returned to lobby / is ready
    socket.on('player_ready', async ({ roomId, playerId }) => {
      try {
        const room = await Room.setPlayerReady(roomId, playerId, true);
        if (room) {
          io.to(roomId).emit('room_updated', room);
        }
      } catch (error) {
        console.error('Error setting player ready:', error);
      }
    });

    // Data updates are now handled via REST API, which emits events.
    // Socket only handles connection/room joining and high-frequency game moves.

    // request_target_word, start_game, and leave_room have been migrated to using REST API endpoints.
    // The client should call the corresponding API, which will then emit the necessary socket events.

    // Submit clue
    socket.on(
      'submit_clue',
      async ({ gameId, roomId, roundNumber, clueWord, clue, isSecondClue }) => {
        try {
          const game = await Game.findByGameId(gameId);
          const room = await Room.findByRoomId(roomId);
          const clueGiver = room.players.find(
            (p) => p.playerId === socket.playerId
          );

          // Validate clue word starts with revealed letters (only for first clue)
          if (!isSecondClue) {
            const revealedStr = game.revealedLetters.join('');
            if (!clueWord.toUpperCase().startsWith(revealedStr)) {
              socket.emit('error', {
                message: `Clue word must start with "${revealedStr}"`,
              });
              return;
            }
          }

          await Game.submitClue(
            gameId,
            roundNumber,
            clueWord,
            clue,
            isSecondClue
          );

          const eventType = isSecondClue
            ? 'second_clue_submitted'
            : 'clue_submitted';
          const logMessage = isSecondClue
            ? `${clueGiver.nickname} gave a second clue: "${clue}"`
            : `${clueGiver.nickname} gave a clue: "${clue}" (clue word starts with ${game.revealedLetters.join('')})`;

          await Game.addGameLogEntry(gameId, eventType, logMessage);

          // Refresh game to get updated log
          const gameWithLog = await Game.findByGameId(gameId);

          io.to(roomId).emit('clue_submitted', {
            game: gameWithLog,
            roundNumber,
            clue,
            isSecondClue,
          });

          // Start round timer if first clue
          if (!isSecondClue) {
            const roundTimeMs = room.settings.roundTime * 60 * 1000;

            const timerKey = `${gameId}_${roundNumber}`;
            if (roundTimers.has(timerKey)) {
              clearTimeout(roundTimers.get(timerKey));
            }

            const timer = setTimeout(async () => {
              await handleRoundTimeout(gameId, roomId, roundNumber, io);
              roundTimers.delete(timerKey);
            }, roundTimeMs);

            roundTimers.set(timerKey, timer);

            // Emit timer start
            io.to(roomId).emit('round_timer_started', {
              roundNumber,
              duration: roundTimeMs,
              startTime: Date.now(),
            });
          }
        } catch (error) {
          console.error('Error submitting clue:', error);
          socket.emit('error', { message: 'Failed to submit clue' });
        }
      }
    );

    // Contact clicked
    socket.on(
      'contact_click',
      async ({ gameId, roomId, roundNumber, playerId, word }) => {
        try {
          const room = await Room.findByRoomId(roomId);
          const player = room.players.find((p) => p.playerId === playerId);

          await Game.addContact(gameId, roundNumber, playerId, word);

          const logMessage = `${player.nickname} clicked CONTACT!`;
          await Game.addGameLogEntry(gameId, 'contact_clicked', logMessage);

          // Get fresh game with updated log
          const gameWithLog = await Game.findByGameId(gameId);

          io.to(roomId).emit('contact_updated', {
            game: gameWithLog,
            playerId,
          });
        } catch (error) {
          console.error('Error adding contact:', error);
          socket.emit('error', { message: 'Failed to add contact' });
        }
      }
    );

    // Update contact
    socket.on(
      'update_contact',
      async ({ gameId, roomId, roundNumber, playerId, word }) => {
        try {
          const room = await Room.findByRoomId(roomId);
          const player = room.players.find((p) => p.playerId === playerId);

          const updatedGame = await Game.updateContact(
            gameId,
            roundNumber,
            playerId,
            word
          );

          const logMessage = `${player.nickname} updated their contact guess`;
          await Game.addGameLogEntry(gameId, 'contact_updated', logMessage);

          io.to(roomId).emit('contact_updated', {
            game: updatedGame,
            playerId,
          });
        } catch (error) {
          console.error('Error updating contact:', error);
          socket.emit('error', { message: 'Failed to update contact' });
        }
      }
    );

    // Remove contact
    socket.on(
      'remove_contact',
      async ({ gameId, roomId, roundNumber, playerId }) => {
        try {
          const room = await Room.findByRoomId(roomId);
          const player = room.players.find((p) => p.playerId === playerId);

          const updatedGame = await Game.removeContact(
            gameId,
            roundNumber,
            playerId
          );

          const logMessage = `${player.nickname} removed their contact`;
          await Game.addGameLogEntry(gameId, 'contact_removed', logMessage);

          io.to(roomId).emit('contact_updated', {
            game: updatedGame,
            playerId,
          });
        } catch (error) {
          console.error('Error removing contact:', error);
          socket.emit('error', { message: 'Failed to remove contact' });
        }
      }
    );

    // Wordmaster guess
    socket.on(
      'wordmaster_guess',
      async ({ gameId, roomId, roundNumber, guess }) => {
        try {
          const game = await Game.findByGameId(gameId);
          const room = await Room.findByRoomId(roomId);
          const wordmaster = room.players.find(
            (p) => p.playerId === game.wordmasterId
          );
          const round = game.rounds.find((r) => r.roundNumber === roundNumber);

          const correct = checkClueWordGuess(guess, round.clueWord);

          const updatedGame = await Game.addWordmasterGuess(
            gameId,
            roundNumber,
            guess,
            correct
          );

          // Award points if correct
          if (correct) {
            await Game.updateScore(
              gameId,
              game.wordmasterId,
              getWordmasterBlockPoints()
            );
          }

          const currentRound = updatedGame.rounds.find(
            (r) => r.roundNumber === roundNumber
          );

          const logMessage = correct
            ? `Wordmaster ${wordmaster.nickname} guessed "${guess}" - CORRECT! Clue word was blocked.`
            : `Wordmaster ${wordmaster.nickname} guessed "${guess}" - Incorrect. ${currentRound.wordmasterGuessesRemaining} guesses remaining.`;

          await Game.addGameLogEntry(gameId, 'wordmaster_guess', logMessage);

          // Get fresh game with updated log
          const gameWithLog = await Game.findByGameId(gameId);

          io.to(roomId).emit('wordmaster_guessed', {
            game: gameWithLog,
            guess,
            correct,
            roundNumber,
          });

          // If correct, end round immediately
          if (correct) {
            const timerKey = `${gameId}_${roundNumber}`;
            if (roundTimers.has(timerKey)) {
              clearTimeout(roundTimers.get(timerKey));
              roundTimers.delete(timerKey);
            }

            await handleRoundEnd(gameId, roomId, roundNumber, false, io);
          }
        } catch (error) {
          console.error('Error processing wordmaster guess:', error);
          socket.emit('error', { message: 'Failed to process guess' });
        }
      }
    );

    // Target word guess
    socket.on(
      'target_word_guess',
      async ({ gameId, roomId, playerId, guess }) => {
        try {
          const game = await Game.findByGameId(gameId);
          const room = await Room.findByRoomId(roomId);
          const player = room.players.find((p) => p.playerId === playerId);

          // Check if player already used their attempt for current letter
          if (game.targetWordGuessAttempts[playerId]) {
            socket.emit('error', {
              message: 'You already used your guess for this letter',
            });
            return;
          }

          const correct = checkTargetWordGuess(guess, game.targetWord);

          await Game.recordTargetWordGuess(gameId, playerId, guess, correct);

          const logMessage = correct
            ? `🎉 ${player.nickname} guessed the target word "${game.targetWord}" - CORRECT! Game over!`
            : `${player.nickname} made an incorrect target word guess`;

          await Game.addGameLogEntry(gameId, 'target_word_guess', logMessage);

          if (correct) {
            // Award points - more points for earlier guesses
            const points = calculateTargetWordPoints(
              game.revealedLetters.length,
              game.targetWord.length
            );

            // Check if first to guess
            const isFirst =
              Object.keys(game.targetWordGuessAttempts).length === 0;
            const totalPoints = points + (isFirst ? getFirstToGuessBonus() : 0);

            await Game.updateScore(gameId, playerId, totalPoints);
            await Game.completeGame(gameId, playerId);

            // Clear any active round timer
            const timerKey = `${gameId}_${game.currentRound}`;
            if (roundTimers.has(timerKey)) {
              clearTimeout(roundTimers.get(timerKey));
              roundTimers.delete(timerKey);
            }

            const finalGame = await Game.findByGameId(gameId);

            const finalLogMessage = `Game completed! ${player.nickname} wins with ${finalGame.scores[playerId]} points!`;
            await Game.addGameLogEntry(
              gameId,
              'game_completed',
              finalLogMessage
            );

            // Update room status
            await Room.updateStatus(roomId, 'completed');

            io.to(roomId).emit('game_completed', {
              game: finalGame,
              winnerId: playerId,
            });
          } else {
            const updatedGame = await Game.findByGameId(gameId);
            socket.emit('target_word_guess_result', {
              correct: false,
              game: updatedGame,
            });
          }
        } catch (error) {
          console.error('Error processing target word guess:', error);
          socket.emit('error', {
            message: 'Failed to process target word guess',
          });
        }
      }
    );



    // Disconnect
    socket.on('disconnect', async () => {
      const { playerId, roomId } = socket;

      if (!playerId || !roomId) return;

      // Remove from tracking
      playerSockets.delete(playerId);

      // Set a grace period (5 seconds) before treating as permanent disconnect
      const disconnectTimer = setTimeout(async () => {
        try {
          // Clear session if player didn't reconnect
          const allSockets = await io.fetchSockets();
          allSockets.some((s) => s.playerId === playerId);

          const room = await Room.findByRoomId(roomId);
          if (!room) return;

          const disconnectedPlayer = room.players.find(
            (p) => p.playerId === playerId
          );
          if (!disconnectedPlayer) return;

          const game = await Game.findActiveGameByRoomId(roomId);

          if (game && room.status === 'in-game') {
            // Player disconnected during active game
            await handlePlayerDisconnectDuringGame(
              playerId,
              roomId,
              room,
              game,
              io,
              roundTimers
            );
          } else if (room.status === 'starting') {
            // Player disconnected during word selection phase
            const wordmaster = room.players.find(
              (p) => p.role === 'wordmaster'
            );

            if (wordmaster && wordmaster.playerId === playerId) {
              // Wordmaster disconnected during word selection
              await Room.updateStatus(roomId, 'waiting');

              io.to(roomId).emit('wordmaster_disconnected_during_setup', {
                wordmasterNickname: disconnectedPlayer.nickname,
              });
            }

            // Remove player from room
            const updatedRoom = await Room.removePlayer(roomId, playerId);

            if (updatedRoom) {
              io.to(roomId).emit('room_updated', updatedRoom);
              io.to(roomId).emit('player_left', {
                playerId,
                nickname: disconnectedPlayer.nickname,
              });
            }
          } else {
            // Player disconnected while in lobby/waiting
            const updatedRoom = await Room.removePlayer(roomId, playerId);

            if (updatedRoom) {
              io.to(roomId).emit('room_updated', updatedRoom);
              io.to(roomId).emit('player_left', {
                playerId,
                nickname: disconnectedPlayer.nickname,
              });
            }
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        } finally {
          disconnectTimers.delete(playerId);
        }
      }, 5000); // 5 second grace period

      disconnectTimers.set(playerId, disconnectTimer);
    });
  });

  return io;
}

// Helper function to handle player disconnect during game
async function handlePlayerDisconnectDuringGame(
  playerId,
  roomId,
  room,
  game,
  io,
  roundTimers
) {
  try {
    const disconnectedPlayer = room.players.find(
      (p) => p.playerId === playerId
    );
    if (!disconnectedPlayer) return;

    const playerNickname = disconnectedPlayer.nickname;
    const isWordmaster = game.wordmasterId === playerId;
    const isCurrentClueGiver =
      game.rounds.length > 0 &&
      game.rounds[game.rounds.length - 1]?.clueGiverId === playerId;

    // Check remaining connected players
    const remainingPlayers = room.players.filter(
      (p) => p.playerId !== playerId
    );

    // If less than 3 players remain, end game
    if (remainingPlayers.length < 3) {
      await Game.addGameLogEntry(
        game.gameId,
        'game_ended',
        `${playerNickname} disconnected. Not enough players to continue. Game ended.`
      );

      await Game.completeGame(game.gameId, null);
      await Room.updateStatus(roomId, 'completed');

      const finalGame = await Game.findByGameId(game.gameId);

      // Clear any active round timer
      const timerKey = `${game.gameId}_${game.currentRound}`;
      if (roundTimers.has(timerKey)) {
        clearTimeout(roundTimers.get(timerKey));
        roundTimers.delete(timerKey);
      }

      io.to(roomId).emit('game_ended_disconnect', {
        game: finalGame,
        reason: 'Not enough players',
        disconnectedPlayer: playerNickname,
      });

      return;
    }

    // Wordmaster disconnected
    if (isWordmaster) {
      await Game.addGameLogEntry(
        game.gameId,
        'game_ended',
        `Wordmaster ${playerNickname} disconnected. Game ended.`
      );

      await Game.completeGame(game.gameId, null);
      await Room.updateStatus(roomId, 'completed');

      const finalGame = await Game.findByGameId(game.gameId);

      // Clear any active round timer
      const timerKey = `${game.gameId}_${game.currentRound}`;
      if (roundTimers.has(timerKey)) {
        clearTimeout(roundTimers.get(timerKey));
        roundTimers.delete(timerKey);
      }

      io.to(roomId).emit('game_ended_disconnect', {
        game: finalGame,
        reason: 'Wordmaster disconnected',
        disconnectedPlayer: playerNickname,
      });

      return;
    }

    // Current clue-giver disconnected
    if (isCurrentClueGiver) {
      await Game.addGameLogEntry(
        game.gameId,
        'player_disconnected',
        `Clue-giver ${playerNickname} disconnected. Ending round early.`
      );

      // End current round and start next round with new clue-giver
      const currentRound = game.rounds[game.rounds.length - 1];

      // Clear round timer
      const timerKey = `${game.gameId}_${currentRound.roundNumber}`;
      if (roundTimers.has(timerKey)) {
        clearTimeout(roundTimers.get(timerKey));
        roundTimers.delete(timerKey);
      }

      // Remove disconnected player from guessers list
      const updatedGuessers = game.guessers.filter((g) => g !== playerId);
      await Game.updateGame(game.gameId, { guessers: updatedGuessers });

      // End round without success
      await Game.endRound(game.gameId, currentRound.roundNumber, false, null);

      // Start next round
      const updatedGame = await Game.findByGameId(game.gameId);
      if (updatedGuessers.length >= 2) {
        const nextGuesserIndex =
          updatedGame.clueGiverIndex % updatedGuessers.length;
        const nextClueGiverId = updatedGuessers[nextGuesserIndex];

        await Game.startNewRound(game.gameId, {
          clueGiverId: nextClueGiverId,
          wordmasterGuessesLimit: room.settings.wordmasterGuesses,
        });

        const nextRoundGame = await Game.findByGameId(game.gameId);

        await Game.addGameLogEntry(
          game.gameId,
          'round_started',
          `Round ${updatedGame.currentRound} started`,
          {
            roundNumber: updatedGame.currentRound,
            clueGiverId: nextClueGiverId,
          }
        );

        io.to(roomId).emit('player_disconnected_during_game', {
          game: nextRoundGame,
          disconnectedPlayer: playerNickname,
          wasClueGiver: true,
        });
      } else {
        // Not enough guessers, end game
        await Game.completeGame(game.gameId, null);
        await Room.updateStatus(roomId, 'completed');

        const finalGame = await Game.findByGameId(game.gameId);

        io.to(roomId).emit('game_ended_disconnect', {
          game: finalGame,
          reason: 'Not enough players',
          disconnectedPlayer: playerNickname,
        });
      }

      return;
    }

    // Regular guesser disconnected (not clue-giver)
    await Game.addGameLogEntry(
      game.gameId,
      'player_disconnected',
      `${playerNickname} disconnected.`
    );

    // Remove from guessers list
    const updatedGuessers = game.guessers.filter((g) => g !== playerId);
    await Game.updateGame(game.gameId, { guessers: updatedGuessers });

    const updatedGame = await Game.findByGameId(game.gameId);

    // Check if still enough guessers
    if (updatedGuessers.length < 2) {
      await Game.completeGame(game.gameId, null);
      await Room.updateStatus(roomId, 'completed');

      const finalGame = await Game.findByGameId(game.gameId);

      // Clear any active round timer
      const currentRound = game.rounds[game.rounds.length - 1];
      const timerKey = `${game.gameId}_${currentRound?.roundNumber}`;
      if (roundTimers.has(timerKey)) {
        clearTimeout(roundTimers.get(timerKey));
        roundTimers.delete(timerKey);
      }

      io.to(roomId).emit('game_ended_disconnect', {
        game: finalGame,
        reason: 'Not enough players',
        disconnectedPlayer: playerNickname,
      });
    } else {
      io.to(roomId).emit('player_disconnected_during_game', {
        game: updatedGame,
        disconnectedPlayer: playerNickname,
        wasClueGiver: false,
      });
    }
  } catch (error) {
    console.error('Error handling player disconnect during game:', error);
  }
}

// Helper function to handle round timeout
async function handleRoundTimeout(gameId, roomId, roundNumber, io) {
  await handleRoundEnd(gameId, roomId, roundNumber, true, io);
}

// Helper function to handle round end
async function handleRoundEnd(gameId, roomId, roundNumber, timeExpired, io) {
  try {
    const game = await Game.findByGameId(gameId);

    // If game is already completed, do not process round end
    if (game.status === 'completed') {
      return;
    }

    const room = await Room.findByRoomId(roomId);
    const round = game.rounds.find((r) => r.roundNumber === roundNumber);

    if (!round) {
      console.error('Round not found');
      return;
    }
    // Check if contacts match the clue word
    const contactResult = checkContactMatch(round.contacts, round.clueWord);

    let newLetter = null;
    let contactSuccessful = false;

    // Successful contact conditions:
    // 1. Time expired (wordmaster didn't block in time)
    // 2. Contacts match
    // 3. Wordmaster ran out of guesses without blocking
    const wordmasterBlocked = round.wordmasterGuesses.some((g) => g.correct);

    // Track points awarded this round
    const pointsAwarded = {};

    if (!wordmasterBlocked && contactResult.matched && timeExpired) {
      contactSuccessful = true;
      // Successful contact - reveal next letter
      newLetter = getNextRevealedLetter(game.targetWord, game.revealedLetters);

      if (newLetter) {
        // Award points
        const contactPoints = getContactSuccessPoints();

        // Award clue giver
        await Game.updateScore(
          gameId,
          round.clueGiverId,
          contactPoints.clueGiver
        );
        pointsAwarded[round.clueGiverId] = contactPoints.clueGiver;

        // Award matching guessers
        for (const playerId of contactResult.matchedPlayers) {
          if (playerId !== round.clueGiverId) {
            await Game.updateScore(gameId, playerId, contactPoints.guesser);
            pointsAwarded[playerId] = contactPoints.guesser;
          }
        }

        const logMessage = `✅ Successful CONTACT! ${contactResult.matchedPlayers.length} player(s) guessed "${round.clueWord}" correctly. Next letter revealed: ${newLetter}`;
        await Game.addGameLogEntry(gameId, 'contact_success', logMessage);
      }
    } else {
      const reason = wordmasterBlocked
        ? 'Wordmaster blocked successfully'
        : contactResult.matched
          ? 'Wordmaster blocked in time'
          : 'Contact guesses did not match';

      const logMessage = `❌ Contact failed. ${reason}. Clue word was "${round.clueWord}".`;
      await Game.addGameLogEntry(gameId, 'contact_failed', logMessage);
    }

    // End round
    const updatedGame = await Game.endRound(
      gameId,
      roundNumber,
      contactSuccessful,
      newLetter
    );

    const roundEndMessage = `Round ${roundNumber} ended.`;
    await Game.addGameLogEntry(gameId, 'round_ended', roundEndMessage);

    // Get wordmaster's last relevant guess
    const wmGuesses = round.wordmasterGuesses || [];
    const lastWmGuess = wmGuesses.length > 0 ? wmGuesses[wmGuesses.length - 1] : null;

    io.to(roomId).emit('round_ended', {
      game: updatedGame,
      roundNumber,
      contactSuccessful,
      clueWord: round.clueWord,
      revealedWords: round.contacts.map((c) => ({
        playerId: c.playerId,
        word: c.word,
        isCorrect: c.word && checkClueWordGuess(c.word, round.clueWord),
      })),
      newLetter,
      pointsAwarded,
      wordmasterGuess: lastWmGuess ? {
        guess: lastWmGuess.guess,
        correct: lastWmGuess.correct
      } : null,
      correctContactPlayers: contactResult.matchedPlayers,
    });

    // Check if game should continue
    if (updatedGame.revealedLetters.length < updatedGame.targetWord.length) {
      // Start next round
      const nextGuesserIndex =
        updatedGame.clueGiverIndex % game.guessers.length;
      const nextClueGiverId = game.guessers[nextGuesserIndex];
      const nextClueGiver = room.players.find(
        (p) => p.playerId === nextClueGiverId
      );

      await Game.startNewRound(gameId, {
        clueGiverId: nextClueGiverId,
        wordmasterGuessesLimit: room.settings.wordmasterGuesses,
      });

      const nextRoundGame = await Game.findByGameId(gameId);

      const roundStartMessage = `Round ${updatedGame.currentRound} started. ${nextClueGiver.nickname} is the clue-giver.`;
      await Game.addGameLogEntry(gameId, 'round_started', roundStartMessage);

      io.to(roomId).emit('next_round_started', {
        game: nextRoundGame,
        roundNumber: updatedGame.currentRound,
      });
    } else {
      // All letters revealed, game over (no winner)
      await Game.addGameLogEntry(
        gameId,
        'game_completed',
        'All letters revealed. No one guessed the word. Game over.'
      );

      await Game.completeGame(gameId, null);
      await Room.updateStatus(roomId, 'completed');

      const finalGame = await Game.findByGameId(gameId);
      io.to(roomId).emit('game_completed', {
        game: finalGame,
        winnerId: null,
      });
    }
  } catch (error) {
    console.error('Error handling round end:', error);
  }
}
