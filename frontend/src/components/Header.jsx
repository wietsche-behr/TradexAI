import { Bell, Settings, User, ChevronDown, Sun, Moon, LogOut } from 'lucide-react';

export default function Header({ theme, toggleTheme, setPage, page, onLogout, user }) {
  return (
    <header className="flex justify-between items-center p-4 text-gray-800 dark:text-white">
      <div className="text-2xl font-bold tracking-wider">
        AURA<span className="text-cyan-500 dark:text-cyan-400">BOT</span>
      </div>
      <div className="flex items-center space-x-6">
        <div className="hidden md:flex items-center space-x-6 bg-gray-500/10 dark:bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-gray-400/20 dark:border-white/20">
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
          <a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
            Analytics
          </a>
        </div>
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
          <button className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
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
      </div>
    </header>
  );
}
