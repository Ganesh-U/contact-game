import { getDB } from '../config/db.js';

const COLLECTION_NAME = 'rooms';

export class Room {
  static generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  static async create(adminId, adminNickname) {
    const db = getDB();
    const roomId = this.generateRoomId();

    const room = {
      roomId,
      adminId,
      players: [
        {
          playerId: adminId,
          nickname: adminNickname,
          role: null,
          isReady: true,
          joinedAt: new Date(),
        },
      ],
      settings: {
        roundTime: 2,
        wordmasterGuesses: 3,
      },
      status: 'waiting',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTION_NAME).insertOne(room);
    return { ...room, _id: result.insertedId };
  }

  static async findByRoomId(roomId) {
    const db = getDB();
    return await db.collection(COLLECTION_NAME).findOne({ roomId });
  }

  static async updateRoom(roomId, updates) {
    const db = getDB();
    const result = await db
      .collection(COLLECTION_NAME)
      .findOneAndUpdate(
        { roomId },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
    return result;
  }

  static async addPlayer(roomId, playerId, nickname) {
    const db = getDB();
    const room = await this.findByRoomId(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.players.length >= 6) {
      throw new Error('Room is full');
    }

    if (room.players.some((p) => p.playerId === playerId)) {
      // Ensure existing player is marked ready on re-join/refresh
      await this.setPlayerReady(roomId, playerId, true);
      return await this.findByRoomId(roomId);
    }

    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { roomId },
      {
        $push: {
          players: {
            playerId,
            nickname,
            role: null,
            isReady: true,
            joinedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async setPlayerReady(roomId, playerId, isReady) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { roomId, 'players.playerId': playerId },
      {
        $set: {
          'players.$.isReady': isReady,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  static async resetAllPlayersReady(roomId) {
    const db = getDB();
    // Set all players' isReady to false
    // We need to use updateOne/updateMany with array filters or just set the field for all elements if possible
    // MongoDB $[] operator updates all elements in array
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { roomId },
      {
        $set: {
          'players.$[].isReady': false,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  static async removePlayer(roomId, playerId) {
    const db = getDB();
    const room = await this.findByRoomId(roomId);

    if (!room) {
      return null;
    }

    // Check if this is the admin leaving
    const isAdmin = room.adminId === playerId;
    const remainingPlayers = room.players.filter(
      (p) => p.playerId !== playerId
    );

    // If no players left, return null (room should be deleted)
    if (remainingPlayers.length === 0) {
      await this.deleteRoom(roomId);
      return null;
    }

    // If admin is leaving and there are other players, transfer admin to next player
    const updates = {
      $pull: { players: { playerId } },
      $set: { updatedAt: new Date() },
    };

    if (isAdmin && remainingPlayers.length > 0) {
      updates.$set.adminId = remainingPlayers[0].playerId;
    }

    const result = await db
      .collection(COLLECTION_NAME)
      .findOneAndUpdate({ roomId }, updates, { returnDocument: 'after' });

    return result;
  }

  static async updatePlayerRole(roomId, playerId, role) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { roomId, 'players.playerId': playerId },
      {
        $set: {
          'players.$.role': role,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  static async updateSettings(roomId, settings) {
    const result = await this.updateRoom(roomId, {
      settings: {
        roundTime: settings.roundTime || 2,
        wordmasterGuesses: settings.wordmasterGuesses || 3,
      },
    });
    return result;
  }

  static async updateStatus(roomId, status) {
    if (status === 'starting') {
      await this.resetAllPlayersReady(roomId);
    }
    return await this.updateRoom(roomId, { status });
  }

  static async deleteRoom(roomId) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).deleteOne({ roomId });
    return result.deletedCount > 0;
  }

  static async getAllRooms() {
    const db = getDB();
    return await db
      .collection(COLLECTION_NAME)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
  }
}
