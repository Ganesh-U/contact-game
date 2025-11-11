import express from 'express';
import { Game } from '../models/Game.js';

const router = express.Router();

// Create a new game
router.post('/', async (req, res) => {
  try {
    const { roomId, wordmasterId, targetWord, wordType, players } = req.body;

    if (!roomId || !wordmasterId || !targetWord || !players) {
      return res.status(400).json({
        error: 'roomId, wordmasterId, targetWord, and players are required',
      });
    }

    if (targetWord.length < 5) {
      return res.status(400).json({
        error: 'Target word must be at least 5 letters',
      });
    }

    const game = await Game.create(
      roomId,
      wordmasterId,
      targetWord,
      wordType,
      players
    );
    res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get game by ID
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await Game.findByGameId(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Get games by room ID
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const games = await Game.findByRoomId(roomId);
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get active game by room ID
router.get('/room/:roomId/active', async (req, res) => {
  try {
    const { roomId } = req.params;
    const game = await Game.findActiveGameByRoomId(roomId);

    if (!game) {
      return res.status(404).json({ error: 'No active game found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching active game:', error);
    res.status(500).json({ error: 'Failed to fetch active game' });
  }
});

// Update game
router.put('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const updates = req.body;

    const updatedGame = await Game.updateGame(gameId, updates);
    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Complete game
router.put('/:gameId/complete', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { winnerId } = req.body;

    const completedGame = await Game.completeGame(gameId, winnerId);
    res.json(completedGame);
  } catch (error) {
    console.error('Error completing game:', error);
    res.status(500).json({ error: 'Failed to complete game' });
  }
});

// Delete game
router.delete('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    await Game.deleteGame(gameId);
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Get all games (for testing/admin purposes)
router.get('/', async (req, res) => {
  try {
    const games = await Game.getAllGames();
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

export default router;
