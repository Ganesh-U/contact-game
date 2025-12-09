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
    
    req.app.get('io').to(roomId).emit('room_updated', updatedRoom);
    
    res.json(updatedRoom);
  } catch (error) {
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
    
    req.app.get('io').to(roomId).emit('room_updated', updatedRoom);
    
    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Failed to add player',
    });
  }
});

// Remove player from room
router.delete('/:roomId/players/:playerId', async (req, res) => {
  try {
    const { roomId, playerId } = req.params;

    // Get room first to get player nickname for notification
    const room = await Room.findByRoomId(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const playerToRemove = room.players.find(p => p.playerId === playerId);

    const updatedRoom = await Room.removePlayer(roomId, playerId);

    if (!updatedRoom) {
      // Room was deleted because it was empty, or it wasn't found
      // Verify if it was deleted
      const checkRoom = await Room.findByRoomId(roomId);
      if (!checkRoom) {
          return res.json({ message: 'Room deleted - no players remaining' });
      }
      return res.status(404).json({ error: 'Room not found after removal' });
    }

    // If no players left, delete the room
    if (updatedRoom.players.length === 0) {
      await Room.deleteRoom(roomId);
      return res.json({ message: 'Room deleted - no players remaining' });
    }

    const io = req.app.get('io');
    io.to(roomId).emit('room_updated', updatedRoom);
    
    if (playerToRemove) {
        io.to(roomId).emit('player_left', { 
            playerId, 
            nickname: playerToRemove.nickname 
        });
    }

    res.json(updatedRoom);
  } catch (error) {
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
    
    req.app.get('io').to(roomId).emit('room_updated', updatedRoom);
    
    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update player role' });
  }
});

// Update room status
router.put('/:roomId/status', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    if (!['waiting', 'in-game', 'completed', 'starting'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
      });
    }

    const updatedRoom = await Room.updateStatus(roomId, status);
    
    const io = req.app.get('io');
    io.to(roomId).emit('room_updated', updatedRoom);
    
    // Handle 'starting' status (Wordmaster choosing phase)
    if (status === 'starting') {
        const wordmaster = updatedRoom.players.find(p => p.role === 'wordmaster');
        if (wordmaster) {
            io.to(roomId).emit('wordmaster_choosing', {
                wordmasterId: wordmaster.playerId,
                wordmasterNickname: wordmaster.nickname,
            });
            io.to(roomId).emit('show_target_word_modal', { wordmasterId: wordmaster.playerId });
        }
    }

    res.json(updatedRoom);
  } catch (error) {
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
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Get all rooms (for testing/admin purposes)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.getAllRooms();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

export default router;
