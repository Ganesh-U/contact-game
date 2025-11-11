import { Link, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import './Header.css';

function Header({ theme, toggleTheme, onRulesClick }) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <div className="logo-section">
            <div className="logo-icon">C</div>
            <h1>CONTACT</h1>
          </div>
        </Link>

        <div className="header-actions">
          {!isHomePage && onRulesClick && (
            <button className="btn-secondary btn-small" onClick={onRulesClick}>
              Rules
            </button>
          )}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  theme: PropTypes.string.isRequired,
  toggleTheme: PropTypes.func.isRequired,
  onRulesClick: PropTypes.func,
};

export default Header;
