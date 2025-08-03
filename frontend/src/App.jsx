import { useState, useEffect } from 'react';
import ParticleBackground from './components/ParticleBackground';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import StrategiesPage from './pages/StrategiesPage';
import StrategyLogsPage from './pages/StrategyLogsPage';
import AssetsPage from './pages/AssetsPage';
import ChartsPage from './pages/ChartsPage';
import ManualTradePage from './pages/ManualTradePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Toaster } from 'react-hot-toast';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [page, setPage] = useState('dashboard');
  const [authPage, setAuthPage] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token'));
  const [user, setUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [logStrategy, setLogStrategy] = useState(null);

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
          if (res.status === 401 && refreshToken) {
            return fetch('http://localhost:8000/token/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            })
              .then((r) => {
                if (!r.ok) throw new Error('refresh_failed');
                return r.json();
              })
              .then((data) => {
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                setToken(data.access_token);
                setRefreshToken(data.refresh_token);
                return fetch('http://localhost:8000/users/me', {
                  headers: { Authorization: `Bearer ${data.access_token}` },
                });
              });
          }
          if (!res.ok) throw new Error('unauthorized');
          return res;
        })
        .then((res) => res.json())
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          setToken(null);
          setRefreshToken(null);
          setUser(null);
        });
    }
  }, [token, refreshToken]);

  useEffect(() => {
    if (!token || !refreshToken) return;
    const interval = setInterval(() => {
      fetch('http://localhost:8000/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('refresh_failed');
          return res.json();
        })
        .then((data) => {
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          setToken(data.access_token);
          setRefreshToken(data.refresh_token);
        })
        .catch(handleLogout);
    }, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, refreshToken]);

  const handleLogin = (tok, refTok) => {
    localStorage.setItem('token', tok);
    localStorage.setItem('refresh_token', refTok);
    setToken(tok);
    setRefreshToken(refTok);
    setPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage theme={theme} token={token} />;
      case 'users':
        return <UserManagementPage />;
      case 'strategies':
        return <StrategiesPage setPage={setPage} setLogStrategy={setLogStrategy} />;
      case 'strategy_logs':
        return (
          <StrategyLogsPage
            strategy={logStrategy}
            token={token}
            onBack={() => setPage('strategies')}
          />
        );
      case 'assets':
        return <AssetsPage />;
      case 'charts':
        return <ChartsPage theme={theme} />;
      case 'manual':
      case 'manual_trade':
        return <ManualTradePage theme={theme} token={token} />;
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
          token={token}
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
