import { useState, useEffect } from 'react';
import GlassCard from '../components/GlassCard';

export default function StrategyLogsPage({ strategy, token, onBack }) {
  const [tab, setTab] = useState('detail');
  const [detailLogs, setDetailLogs] = useState([]);
  const [tradeLogs, setTradeLogs] = useState([]);

  useEffect(() => {
    if (!strategy) return;
    fetch(`http://localhost:8000/strategy/${strategy}/logs?log_type=detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setDetailLogs(data.logs || []))
      .catch(() => setDetailLogs([]));
    fetch(`http://localhost:8000/strategy/${strategy}/logs?log_type=trade`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setTradeLogs(data.logs || []))
      .catch(() => setTradeLogs([]));
  }, [strategy, token]);

  const activeClass =
    'border-b-2 border-cyan-500 text-cyan-500 dark:text-cyan-400';

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <button onClick={onBack} className="mb-4 text-cyan-600 hover:underline">
        ← Back
      </button>
      <GlassCard>
        <div className="flex space-x-4 border-b border-gray-400/20 dark:border-white/20 mb-4">
          <button
            onClick={() => setTab('detail')}
            className={`py-2 ${tab === 'detail' ? activeClass : ''}`}
          >
            Detail Logs
          </button>
          <button
            onClick={() => setTab('trade')}
            className={`py-2 ${tab === 'trade' ? activeClass : ''}`}
          >
            Trade Logs
          </button>
        </div>
        {tab === 'detail' ? (
          <div className="space-y-1 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
            {detailLogs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
            {tradeLogs.map((t, i) => (
              <div key={i}>{t}</div>
            ))}
          </div>
        )}
      </GlassCard>
    </main>
  );
}
