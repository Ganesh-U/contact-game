import { getDB } from '../config/db.js';

const COLLECTION_NAME = 'games';

export class Game {
  static generateGameId() {
    return `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  static async create(roomId, wordmasterId, targetWord, wordType, players) {
    const db = getDB();
    const gameId = this.generateGameId();

    const guessers = players.filter((p) => p.role === 'guesser');
    const scores = {};
    players.forEach((p) => {
      scores[p.playerId] = 0;
    });

    const game = {
      gameId,
      roomId,
      wordmasterId,
      targetWord: targetWord.toUpperCase(),
      wordType,
      revealedLetters: [targetWord[0].toUpperCase()],
      currentRound: 1,
      clueGiverIndex: 0,
      guessers: guessers.map((g) => g.playerId),
      rounds: [],
      scores,
      targetWordGuessAttempts: {}, // playerId: boolean (one attempt per letter reveal)
      gameLog: [
        {
          timestamp: new Date(),
          event: 'game_started',
          message: 'Game started! Wordmaster has chosen the target word.',
        },
      ],
      status: 'active',
      winner: null,
      createdAt: new Date(),
      completedAt: null,
    };

    const result = await db.collection(COLLECTION_NAME).insertOne(game);
    return { ...game, _id: result.insertedId };
  }

  static async findByGameId(gameId) {
    const db = getDB();
    return await db.collection(COLLECTION_NAME).findOne({ gameId });
  }

  static async findByRoomId(roomId) {
    const db = getDB();
    return await db
      .collection(COLLECTION_NAME)
      .find({ roomId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async findActiveGameByRoomId(roomId) {
    const db = getDB();
    return await db
      .collection(COLLECTION_NAME)
      .findOne({ roomId, status: 'active' });
  }

  static async updateGame(gameId, updates) {
    const db = getDB();
    const result = await db
      .collection(COLLECTION_NAME)
      .findOneAndUpdate(
        { gameId },
        { $set: updates },
        { returnDocument: 'after' }
      );
    return result;
  }

  static async startNewRound(gameId, roundData) {
    const db = getDB();
    const game = await this.findByGameId(gameId);

    const newRound = {
      roundNumber: game.currentRound,
      clueGiverId: roundData.clueGiverId,
      clueWord: null,
      clue: null,
      clueSubmittedAt: null,
      secondClue: null,
      secondClueSubmittedAt: null,
      contacts: [], // { playerId, word, submittedAt }
      wordmasterGuesses: [], // { guess, timestamp, correct }
      wordmasterGuessesRemaining: roundData.wordmasterGuessesLimit,
      roundEndedAt: null,
      contactSuccessful: false,
      startedAt: new Date(),
    };

    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { gameId },
      {
        $push: { rounds: newRound },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async submitClue(gameId, roundNumber, clueWord, clue, isSecondClue) {
    const db = getDB();
    const updateField = isSecondClue
      ? {
          'rounds.$.secondClue': clue,
          'rounds.$.secondClueSubmittedAt': new Date(),
        }
      : {
          'rounds.$.clueWord': clueWord.toUpperCase(),
          'rounds.$.clue': clue,
          'rounds.$.clueSubmittedAt': new Date(),
        };

    const result = await db
      .collection(COLLECTION_NAME)
      .findOneAndUpdate(
        { gameId, 'rounds.roundNumber': roundNumber },
        { $set: updateField },
        { returnDocument: 'after' }
      );

    return result;
  }

  static async addContact(gameId, roundNumber, playerId, word) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { gameId, 'rounds.roundNumber': roundNumber },
      {
        $push: {
          'rounds.$.contacts': {
            playerId,
            word: word.toUpperCase(),
            submittedAt: new Date(),
          },
        },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async updateContact(gameId, roundNumber, playerId, word) {
    const db = getDB();
    const game = await this.findByGameId(gameId);
    const round = game.rounds.find((r) => r.roundNumber === roundNumber);
    const contactIndex = round.contacts.findIndex(
      (c) => c.playerId === playerId
    );

    if (contactIndex === -1) {
      return await this.addContact(gameId, roundNumber, playerId, word);
    }

    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      {
        gameId,
        'rounds.roundNumber': roundNumber,
        'rounds.contacts.playerId': playerId,
      },
      {
        $set: {
          'rounds.$[round].contacts.$[contact].word': word.toUpperCase(),
          'rounds.$[round].contacts.$[contact].submittedAt': new Date(),
        },
      },
      {
        arrayFilters: [
          { 'round.roundNumber': roundNumber },
          { 'contact.playerId': playerId },
        ],
        returnDocument: 'after',
      }
    );

    return result;
  }

  static async removeContact(gameId, roundNumber, playerId) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { gameId, 'rounds.roundNumber': roundNumber },
      {
        $pull: {
          'rounds.$.contacts': { playerId },
        },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async addWordmasterGuess(gameId, roundNumber, guess, correct) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { gameId, 'rounds.roundNumber': roundNumber },
      {
        $push: {
          'rounds.$.wordmasterGuesses': {
            guess: guess.toUpperCase(),
            timestamp: new Date(),
            correct,
          },
        },
        $inc: { 'rounds.$.wordmasterGuessesRemaining': -1 },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async endRound(
    gameId,
    roundNumber,
    contactSuccessful,
    newRevealedLetter = null
  ) {
    const db = getDB();
    const updates = {
      'rounds.$.roundEndedAt': new Date(),
      'rounds.$.contactSuccessful': contactSuccessful,
      currentRound: roundNumber + 1,
      clueGiverIndex: roundNumber, // Next guesser becomes clue giver
    };

    if (newRevealedLetter) {
      const game = await this.findByGameId(gameId);
      updates.revealedLetters = [
        ...game.revealedLetters,
        newRevealedLetter.toUpperCase(),
      ];
      updates.targetWordGuessAttempts = {}; // Reset attempts for new letter
    }

    const result = await db
      .collection(COLLECTION_NAME)
      .findOneAndUpdate(
        { gameId, 'rounds.roundNumber': roundNumber },
        { $set: updates },
        { returnDocument: 'after' }
      );

    return result;
  }

  static async recordTargetWordGuess(gameId, playerId, guess, correct) {
    const db = getDB();
    const updates = {
      [`targetWordGuessAttempts.${playerId}`]: true,
    };

    if (correct) {
      updates.status = 'completed';
      updates.winner = playerId;
      updates.completedAt = new Date();
    }

    const result = await db
      .collection(COLLECTION_NAME)
      .findOneAndUpdate(
        { gameId },
        { $set: updates },
        { returnDocument: 'after' }
      );

    return result;
  }

  static async updateScore(gameId, playerId, pointsToAdd) {
    const db = getDB();
    const result = await db
      .collection(COLLECTION_NAME)
      .findOneAndUpdate(
        { gameId },
        { $inc: { [`scores.${playerId}`]: pointsToAdd } },
        { returnDocument: 'after' }
      );

    return result;
  }

  static async addGameLogEntry(gameId, event, message, metadata = {}) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { gameId },
      {
        $push: {
          gameLog: {
            timestamp: new Date(),
            event,
            message,
            ...metadata,
          },
        },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async completeGame(gameId, winnerId) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).findOneAndUpdate(
      { gameId },
      {
        $set: {
          status: 'completed',
          winner: winnerId,
          completedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async getAllGames() {
    const db = getDB();
    return await db
      .collection(COLLECTION_NAME)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async deleteGame(gameId) {
    const db = getDB();
    const result = await db.collection(COLLECTION_NAME).deleteOne({ gameId });
    return result.deletedCount > 0;
  }

  static async validateWord(word) {
    const db = getDB();
    return (await db.collection('words').findOne({ word: word.toLowerCase() }))
      ? true
      : false;
  }
}
