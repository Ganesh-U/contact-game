import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/contact';
const client = new MongoClient(uri);

let db = null;

export async function connectDB() {
  try {
    await client.connect();
    db = client.db();
    console.log('✅ Connected to MongoDB');

    await db.collection('rooms').createIndex({ roomId: 1 }, { unique: true });
    await db.collection('games').createIndex({ gameId: 1 }, { unique: true });
    await db.collection('games').createIndex({ roomId: 1 });

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}
