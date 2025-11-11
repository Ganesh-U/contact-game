import express from 'express';
import { Room } from '../models/Room.js';

const router = express.Router();

// Create a new room
router.post('/', async (req, res) => {
  try {
    const { adminId, adminNickname } = req.body;

    if (!adminId || !adminNickname) {
      return res.status(400).json({
        error: 'adminId and adminNickname are required',
      });
    }

    const room = await Room.create(adminId, adminNickname);
    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room by ID
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findByRoomId(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Update room settings
router.put('/:roomId/settings', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { roundTime, wordmasterGuesses, requesterId } = req.body;

    const room = await Room.findByRoomId(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only admin can update settings
    if (room.adminId !== requesterId) {
      return res.status(403).json({ error: 'Only admin can update settings' });
    }

    const settings = {
      roundTime: roundTime || room.settings.roundTime,
      wordmasterGuesses: wordmasterGuesses || room.settings.wordmasterGuesses,
    };

    const updatedRoom = await Room.updateSettings(roomId, settings);
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating room settings:', error);
    res.status(500).json({ error: 'Failed to update room settings' });
  }
});

// Add player to room
router.post('/:roomId/players', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { playerId, nickname } = req.body;

    if (!playerId || !nickname) {
      return res.status(400).json({
        error: 'playerId and nickname are required',
      });
    }

    const updatedRoom = await Room.addPlayer(roomId, playerId, nickname);
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error adding player:', error);
    res.status(500).json({
      error: error.message || 'Failed to add player',
    });
  }
});

// Remove player from room
router.delete('/:roomId/players/:playerId', async (req, res) => {
  try {
    const { roomId, playerId } = req.params;

    const updatedRoom = await Room.removePlayer(roomId, playerId);

    if (!updatedRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // If no players left, delete the room
    if (updatedRoom.players.length === 0) {
      await Room.deleteRoom(roomId);
      return res.json({ message: 'Room deleted - no players remaining' });
    }

    res.json(updatedRoom);
  } catch (error) {
    console.error('Error removing player:', error);
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

// Update player role
router.put('/:roomId/players/:playerId/role', async (req, res) => {
  try {
    const { roomId, playerId } = req.params;
    const { role } = req.body;

    if (!['wordmaster', 'guesser', null].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be wordmaster, guesser, or null',
      });
    }

    const updatedRoom = await Room.updatePlayerRole(roomId, playerId, role);
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating player role:', error);
    res.status(500).json({ error: 'Failed to update player role' });
  }
});

// Update room status
router.put('/:roomId/status', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    if (!['waiting', 'in-game', 'completed'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
      });
    }

    const updatedRoom = await Room.updateStatus(roomId, status);
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({ error: 'Failed to update room status' });
  }
});

// Delete room
router.delete('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { requesterId } = req.body;

    const room = await Room.findByRoomId(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only admin can delete room
    if (room.adminId !== requesterId) {
      return res.status(403).json({ error: 'Only admin can delete room' });
    }

    await Room.deleteRoom(roomId);
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Get all rooms (for testing/admin purposes)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

export default router;
