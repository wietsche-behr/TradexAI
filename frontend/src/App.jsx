import { useState, useEffect } from 'react';
import ParticleBackground from './components/ParticleBackground';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import StrategiesPage from './pages/StrategiesPage';
import AssetsPage from './pages/AssetsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Toaster } from 'react-hot-toast';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [page, setPage] = useState('dashboard');
  const [authPage, setAuthPage] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (token) {
      fetch('http://localhost:8000/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error('unauthorized');
          return res.json();
        })
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        });
    }
  }, [token]);

  const handleLogin = (tok) => {
    localStorage.setItem('token', tok);
    setToken(tok);
    setPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage theme={theme} token={token} />;
      case 'users':
        return <UserManagementPage />;
      case 'strategies':
        return <StrategiesPage />;
      case 'assets':
        return <AssetsPage />;
      default:
        return <DashboardPage theme={theme} token={token} />;
    }
  };

  if (!token) {
    if (authPage === 'register') {
      return (
        <RegisterPage
          onRegistered={() => setAuthPage('login')}
          goToLogin={() => setAuthPage('login')}
        />
      );
    }
    return (
      <LoginPage
        onLogin={handleLogin}
        theme={theme}
        goToRegister={() => setAuthPage('register')}
      />
    );
  }

  return (
    <div className="relative min-h-screen font-sans transition-colors duration-500 bg-gray-100 dark:bg-gray-900">
      <ParticleBackground theme={theme} />
      <Toaster position="top-right" />
      <div className="relative z-10 min-h-screen w-full h-full">
        <Header
          theme={theme}
          toggleTheme={toggleTheme}
          setPage={setPage}
          page={page}
          onLogout={handleLogout}
          user={user}
          onOpenSettings={() => setShowSettings(true)}
        />
        {renderPage()}
        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          token={token}
        />
      </div>
    </div>
  );
}
