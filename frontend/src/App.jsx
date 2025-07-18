import { useState, useEffect } from 'react';
import ParticleBackground from './components/ParticleBackground';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import StrategiesPage from './pages/StrategiesPage';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage theme={theme} />;
      case 'users':
        return <UserManagementPage />;
      case 'strategies':
        return <StrategiesPage />;
      default:
        return <DashboardPage theme={theme} />;
    }
  };

  return (
    <div className="relative min-h-screen font-sans transition-colors duration-500 bg-gray-100 dark:bg-gray-900">
      <ParticleBackground theme={theme} />
      <div className="relative z-10 min-h-screen w-full h-full">
        <Header theme={theme} toggleTheme={toggleTheme} setPage={setPage} page={page} />
        {renderPage()}
      </div>
    </div>
  );
}
