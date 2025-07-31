import { Bell, Settings, User, ChevronDown, Sun, Moon, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header({ theme, toggleTheme, setPage, page, onLogout, user, onOpenSettings, token }) {
  const [portfolio, setPortfolio] = useState(null);
  const [display, setDisplay] = useState('USDT');

  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:8000/portfolio_value', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setPortfolio(data.total_usdt))
      .catch(() => setPortfolio(null));
  }, [token]);

  const toggleDisplay = () => {
    setDisplay((prev) => (prev === 'USDT' ? 'USD' : prev === 'USD' ? 'ZAR' : 'USDT'));
  };

  const formatValue = () => {
    if (portfolio == null) return '...';
    if (display === 'USDT') return `${portfolio.toFixed(2)} USDT`;
    if (display === 'USD') return `$${portfolio.toFixed(2)}`;
    const zarRate = 19; // simple static rate
    return `R${(portfolio * zarRate).toFixed(2)}`;
  };

  return (
    <header
      className="sticky top-0 z-20 flex items-center p-4 text-gray-800 dark:text-white bg-white/70 dark:bg-gray-900/50 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow"
    >
      <div className="flex-1 text-2xl font-bold tracking-wider flex items-center space-x-4">
        <span>
          AURA<span className="text-cyan-500 dark:text-cyan-400">BOT</span>
        </span>
        <button
          onClick={toggleDisplay}
          className="text-sm px-2 py-1 rounded-md bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition"
        >
          {formatValue()}
        </button>
      </div>
      <nav className="hidden md:flex flex-grow justify-center overflow-x-auto">
        <div className="flex flex-wrap items-center gap-4 md:gap-6 bg-gray-500/10 dark:bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-gray-400/20 dark:border-white/20">
          <a
            href="#"
            onClick={() => setPage('dashboard')}
            className={`${
              page === 'dashboard' ? 'text-cyan-600 dark:text-cyan-400' : ''
            } hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors`}
          >
            Dashboard
          </a>
          <a
            href="#"
            onClick={() => setPage('users')}
            className={`${
              page === 'users' ? 'text-cyan-600 dark:text-cyan-400' : ''
            } hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors`}
          >
            User Management
          </a>
          <a
            href="#"
            onClick={() => setPage('strategies')}
            className={`${
              page === 'strategies' ? 'text-cyan-600 dark:text-cyan-400' : ''
            } hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors`}
          >
            Strategies
          </a>
          <a
            href="#"
            onClick={() => setPage('assets')}
            className={`${
              page === 'assets' ? 'text-cyan-600 dark:text-cyan-400' : ''
            } hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors`}
          >
            Assets
          </a>
          <a
            href="#"
            onClick={() => setPage('charts')}
            className={`${
              page === 'charts' ? 'text-cyan-600 dark:text-cyan-400' : ''
            } hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors`}
          >
            Charts
          </a>
          <a
            href="#"
            onClick={() => setPage('manual')}
            className={`${
              page === 'manual' ? 'text-cyan-600 dark:text-cyan-400' : ''
            } hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors`}
          >
            Manual Trading
          </a>
        </div>
      </nav>
      <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
            <Bell size={20} />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            <Settings size={20} />
          </button>
          <div className="flex items-center space-x-2">
            <User size={24} className="p-1 bg-cyan-500 rounded-full text-white" />
            <span className="hidden sm:inline">{user?.username || 'User'}</span>
            <button onClick={onLogout} className="p-1" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
    );
}
