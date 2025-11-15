import express from 'express';
import { createServer } from 'http';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import roomsRouter from './routes/rooms.js';
import gamesRouter from './routes/games.js';
import { initializeGameSocket } from './socket/gameSocket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 5001;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/contact';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'contact-game-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions',
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  },
});

app.use(sessionMiddleware);

// API Routes - MUST come BEFORE static files
app.use('/api/rooms', roomsRouter);
app.use('/api/games', gamesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Contact Game API is running' });
});

app.use(express.static(path.join(__dirname, '../frontend/build')));

// React Router catch-all - send all non-API requests to React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await connectDB();
    initializeGameSocket(server, sessionMiddleware);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
    });
  } catch (error) {
    process.exit(1);
  }
}

startServer();
