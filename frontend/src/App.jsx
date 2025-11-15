import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useState, useEffect } from 'react';
import HomePage from './components/HomePage/HomePage';
import RoomPage from './components/RoomPage/RoomPage';
import GamePage from './components/GamePage/GamePage';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Modal from './components/shared/Modal';
import './App.css';

function AppContent() {
  const location = useLocation();
  const [theme, setTheme] = useState('dark');
  const [playerId, setPlayerId] = useState('');
  const [nickname, setNickname] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    // Get or create player ID from sessionStorage
    let storedPlayerId = sessionStorage.getItem('playerId');
    if (!storedPlayerId) {
      storedPlayerId = `player_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      sessionStorage.setItem('playerId', storedPlayerId);
    }
    setPlayerId(storedPlayerId);

    // Get nickname if exists
    const storedNickname = sessionStorage.getItem('nickname');
    if (storedNickname) {
      setNickname(storedNickname);
    }

    // Get theme preference
    const storedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(storedTheme);
    document.body.className = storedTheme === 'light' ? 'light-theme' : '';
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.className = newTheme === 'light' ? 'light-theme' : '';
  };

  const setPlayerNickname = (nick) => {
    setNickname(nick);
    sessionStorage.setItem('nickname', nick);
  };

  const isHomePage = location.pathname === '/';

  return (
    <div className="app">
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        onRulesClick={!isHomePage ? () => setShowRulesModal(true) : null}
      />
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                playerId={playerId}
                nickname={nickname}
                setNickname={setPlayerNickname}
              />
            }
          />
          <Route
            path="/room/:roomId"
            element={
              <RoomPage
                playerId={playerId}
                nickname={nickname}
                setNickname={setPlayerNickname}
              />
            }
          />
          <Route
            path="/game/:roomId"
            element={<GamePage playerId={playerId} nickname={nickname} />}
          />
        </Routes>
      </main>
      <Footer />

      {/* Global Rules Modal */}
      {showRulesModal && (
        <Modal title="Game Rules" onClose={() => setShowRulesModal(false)}>
          <div className="rules-modal-content">
            <h4>How to Play Contact</h4>
            <ol>
              <li>One player is the Wordmaster, others are Guessers</li>
              <li>Wordmaster chooses a secret word (minimum 5 letters)</li>
              <li>First letter is revealed to Guessers</li>
              <li>Each round, one Guesser becomes the clue-giver</li>
              <li>
                Clue-giver thinks of a word starting with revealed letters and
                gives a clue
              </li>
              <li>
                Other Guessers try to guess the clue word and click CONTACT
              </li>
              <li>Wordmaster tries to block by guessing the clue word</li>
              <li>
                If contacts match and Wordmaster fails to block, next letter
                reveals
              </li>
              <li>
                Guessers can guess the full secret word after each letter reveal
              </li>
              <li>First to guess the complete secret word wins!</li>
            </ol>
          </div>
        </Modal>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
