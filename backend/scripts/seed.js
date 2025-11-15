import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

// ---- 1 Connect to MongoDB ----
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'contact';
const COLLECTION_NAME = 'words';

async function seedWords() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB connected');

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // ---- 2 Load JSON ----
    const data = JSON.parse(await fs.readFile('scripts/words.json', 'utf8'));

    // ---- 3 Prepare entries ----
    const entries = Object.keys(data).map((words) => ({ words }));

    // ---- 4 Clear and insert ----
    await collection.deleteMany({});
    console.log('🧹 Cleared existing word entries.');

    const result = await collection.insertMany(entries);
    console.log(`✅ Inserted ${result.insertedCount} words successfully!`);
  } catch (err) {
    console.error('❌ Error inserting words:', err);
  } finally {
    await client.close();
    console.log('🔒 MongoDB connection closed.');
  }
}

seedWords();
