import { connectDB, getDB, closeDB } from '../config/db.js';

const FIRST_NAMES = [
  'Alex',
  'Sam',
  'Jordan',
  'Taylor',
  'Morgan',
  'Casey',
  'Riley',
  'Avery',
  'Quinn',
  'Reese',
  'Jamie',
  'Skyler',
  'Dakota',
  'Charlie',
  'Drew',
  'Parker',
  'Rowan',
  'Sage',
  'River',
  'Phoenix',
  'Blake',
  'Cameron',
  'Devon',
  'Emerson',
];

const TARGET_WORDS = [
  'ELEPHANT',
  'GIRAFFE',
  'DOLPHIN',
  'BUTTERFLY',
  'MOUNTAIN',
  'RAINBOW',
  'TELESCOPE',
  'BICYCLE',
  'WATERFALL',
  'ORCHESTRA',
  'PYRAMID',
  'SYMPHONY',
  'GALAXY',
  'MEADOW',
  'THUNDER',
  'HORIZON',
  'COMPASS',
  'TREASURE',
  'CRYSTAL',
  'PHOENIX',
  'WHISPER',
  'HARMONY',
  'TRIUMPH',
  'JOURNEY',
];

const WORD_TYPES = ['noun', 'verb', 'adjective', 'other'];

const CLUE_WORDS = [
  'EMERALD',
  'ENIGMA',
  'ELASTIC',
  'ELEPHANT',
  'ELEMENT',
  'ELEGANT',
  'GRAVITY',
  'GIRAFFE',
  'GLACIER',
  'GALAXY',
  'GARDEN',
  'GARLIC',
  'DOLPHIN',
  'DRAGON',
  'DIAMOND',
  'DANGER',
  'DANCER',
  'DARING',
];

const CLUES = [
  'A green precious stone',
  'A mystery or puzzle',
  'Stretchy material',
  'Large gray animal',
  'Basic substance',
  'Graceful and refined',
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  const db = getDB();

  // Clear existing data
  await db.collection('rooms').deleteMany({});
  await db.collection('games').deleteMany({});
  console.log('🗑️  Cleared existing data');

  // Generate rooms
  const rooms = [];
  const TOTAL_ROOMS = 150;

  for (let i = 0; i < TOTAL_ROOMS; i++) {
    const roomId = generateRoomId();
    const numPlayers = randomInt(3, 6);
    const players = [];
    const adminId = generatePlayerId();

    for (let j = 0; j < numPlayers; j++) {
      const playerId = j === 0 ? adminId : generatePlayerId();
      const role = j === 0 ? 'wordmaster' : j === 1 ? null : 'guesser';

      players.push({
        playerId,
        nickname: `${randomItem(FIRST_NAMES)}${randomInt(1, 999)}`,
        role,
        isReady: Math.random() > 0.3,
        joinedAt: new Date(Date.now() - randomInt(1000, 100000) * 1000),
      });
    }

    const status = ['waiting', 'in-game', 'completed'][randomInt(0, 2)];

    rooms.push({
      roomId,
      adminId,
      players,
      settings: {
        roundTime: randomInt(1, 5),
        wordmasterGuesses: randomInt(3, 5),
      },
      status,
      createdAt: new Date(Date.now() - randomInt(1000, 500000) * 1000),
      updatedAt: new Date(Date.now() - randomInt(100, 10000) * 1000),
    });
  }

  await db.collection('rooms').insertMany(rooms);
  console.log(`✅ Created ${rooms.length} rooms`);

  // Generate games
  const games = [];
  const TOTAL_GAMES = 200;

  for (let i = 0; i < TOTAL_GAMES; i++) {
    const gameId = generateGameId();
    const room = randomItem(rooms.filter((r) => r.status !== 'waiting'));
    const wordmaster = room.players.find((p) => p.role === 'wordmaster');
    const guessers = room.players.filter((p) => p.role === 'guesser');

    const targetWord = randomItem(TARGET_WORDS);
    const revealedCount = randomInt(1, Math.floor(targetWord.length * 0.6));
    const revealedLetters = targetWord.substring(0, revealedCount).split('');

    const scores = {};
    room.players.forEach((p) => {
      scores[p.playerId] = randomInt(0, 200);
    });

    const numRounds = randomInt(3, 10);
    const rounds = [];

    for (let r = 1; r <= numRounds; r++) {
      const clueGiver = randomItem(guessers);
      const clueWord = randomItem(CLUE_WORDS);
      const numContacts = randomInt(1, guessers.length);
      const contacts = [];

      for (let c = 0; c < numContacts; c++) {
        const guesser = guessers[c];
        contacts.push({
          playerId: guesser.playerId,
          word: randomItem(CLUE_WORDS),
          submittedAt: new Date(Date.now() - randomInt(100, 5000) * 1000),
        });
      }

      const numWMGuesses = randomInt(0, 3);
      const wmGuesses = [];
      for (let g = 0; g < numWMGuesses; g++) {
        wmGuesses.push({
          guess: randomItem(CLUE_WORDS),
          timestamp: new Date(Date.now() - randomInt(100, 5000) * 1000),
          correct: Math.random() > 0.7,
        });
      }

      rounds.push({
        roundNumber: r,
        clueGiverId: clueGiver.playerId,
        clueWord: clueWord,
        clue: randomItem(CLUES),
        clueSubmittedAt: new Date(Date.now() - randomInt(1000, 10000) * 1000),
        secondClue: Math.random() > 0.7 ? randomItem(CLUES) : null,
        secondClueSubmittedAt:
          Math.random() > 0.7
            ? new Date(Date.now() - randomInt(100, 5000) * 1000)
            : null,
        contacts,
        wordmasterGuesses: wmGuesses,
        wordmasterGuessesRemaining: 3 - numWMGuesses,
        roundEndedAt: new Date(Date.now() - randomInt(100, 5000) * 1000),
        contactSuccessful: Math.random() > 0.5,
        startedAt: new Date(Date.now() - randomInt(5000, 20000) * 1000),
      });
    }

    const gameLog = [
      {
        timestamp: new Date(Date.now() - randomInt(10000, 50000) * 1000),
        event: 'game_started',
        message: 'Game started! Wordmaster has chosen the target word.',
      },
    ];

    for (let r = 1; r <= numRounds; r++) {
      gameLog.push({
        timestamp: new Date(Date.now() - randomInt(1000, 10000) * 1000),
        event: 'round_started',
        message: `Round ${r} started`,
      });
      gameLog.push({
        timestamp: new Date(Date.now() - randomInt(100, 5000) * 1000),
        event: 'round_ended',
        message: `Round ${r} ended`,
      });
    }

    const status = Math.random() > 0.3 ? 'completed' : 'active';
    const winner =
      status === 'completed' ? randomItem(room.players).playerId : null;

    games.push({
      gameId,
      roomId: room.roomId,
      wordmasterId: wordmaster.playerId,
      targetWord,
      wordType: randomItem(WORD_TYPES),
      revealedLetters,
      currentRound: numRounds + 1,
      clueGiverIndex: numRounds,
      guessers: guessers.map((g) => g.playerId),
      rounds,
      scores,
      targetWordGuessAttempts: {},
      gameLog,
      status,
      winner,
      createdAt: new Date(Date.now() - randomInt(10000, 500000) * 1000),
      completedAt:
        status === 'completed'
          ? new Date(Date.now() - randomInt(100, 10000) * 1000)
          : null,
    });
  }

  await db.collection('games').insertMany(games);
  console.log(`✅ Created ${games.length} games`);

  // Create additional synthetic data to reach 1000+ records
  const additionalRooms = [];
  const ADDITIONAL_ROOMS = 400;

  for (let i = 0; i < ADDITIONAL_ROOMS; i++) {
    const roomId = generateRoomId();
    const numPlayers = randomInt(2, 6);
    const players = [];
    const adminId = generatePlayerId();

    for (let j = 0; j < numPlayers; j++) {
      const playerId = j === 0 ? adminId : generatePlayerId();
      players.push({
        playerId,
        nickname: `${randomItem(FIRST_NAMES)}${randomInt(1, 9999)}`,
        role: null,
        isReady: false,
        joinedAt: new Date(Date.now() - randomInt(100000, 1000000) * 1000),
      });
    }

    additionalRooms.push({
      roomId,
      adminId,
      players,
      settings: {
        roundTime: 3,
        wordmasterGuesses: 3,
      },
      status: 'waiting',
      createdAt: new Date(Date.now() - randomInt(100000, 2000000) * 1000),
      updatedAt: new Date(Date.now() - randomInt(10000, 100000) * 1000),
    });
  }

  await db.collection('rooms').insertMany(additionalRooms);
  console.log(`✅ Created ${additionalRooms.length} additional rooms`);

  const additionalGames = [];
  const ADDITIONAL_GAMES = 350;

  for (let i = 0; i < ADDITIONAL_GAMES; i++) {
    const gameId = generateGameId();
    const targetWord = randomItem(TARGET_WORDS);
    const numPlayers = randomInt(3, 6);
    const playerIds = Array.from({ length: numPlayers }, () =>
      generatePlayerId()
    );
    const wordmasterId = playerIds[0];
    const guessers = playerIds.slice(1);

    const scores = {};
    playerIds.forEach((id) => {
      scores[id] = randomInt(0, 150);
    });

    additionalGames.push({
      gameId,
      roomId: generateRoomId(),
      wordmasterId,
      targetWord,
      wordType: randomItem(WORD_TYPES),
      revealedLetters: [targetWord[0]],
      currentRound: 1,
      clueGiverIndex: 0,
      guessers,
      rounds: [],
      scores,
      targetWordGuessAttempts: {},
      gameLog: [
        {
          timestamp: new Date(Date.now() - randomInt(100000, 2000000) * 1000),
          event: 'game_started',
          message: 'Game started',
        },
      ],
      status: 'completed',
      winner: randomItem(playerIds),
      createdAt: new Date(Date.now() - randomInt(100000, 2000000) * 1000),
      completedAt: new Date(Date.now() - randomInt(10000, 100000) * 1000),
    });
  }

  await db.collection('games').insertMany(additionalGames);
  console.log(`✅ Created ${additionalGames.length} additional games`);

  // Summary
  const roomCount = await db.collection('rooms').countDocuments();
  const gameCount = await db.collection('games').countDocuments();
  const totalRecords = roomCount + gameCount;

  console.log('\n📊 Seeding Summary:');
  console.log(`   Rooms: ${roomCount}`);
  console.log(`   Games: ${gameCount}`);
  console.log(`   Total Records: ${totalRecords}`);
  console.log('\n✅ Database seeding completed successfully!');
}

async function main() {
  try {
    await connectDB();
    await seedDatabase();
    await closeDB();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await closeDB();
    process.exit(1);
  }
}

main();
