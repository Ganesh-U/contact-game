const { MongoClient } = require('mongodb');
const fs = require('fs');
require('dotenv').config();

// ---- 1️ Connect to MongoDB ----
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'contact';
const COLLECTION_NAME = 'words';

async function seedWords() {
  const client = new MongoClient(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log('✅ MongoDB connected');

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // ---- 2️ Load JSON ----
    const data = JSON.parse(fs.readFileSync('words.json', 'utf8'));

    // ---- 3️ Prepare entries ----
    const entries = Object.keys(data).map(words => ({ words }));

    // ---- 4️ Clear and insert ----
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
