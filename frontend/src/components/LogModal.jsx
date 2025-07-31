import { useState, useEffect } from 'react';
import GlassCard from './GlassCard';

export default function LogModal({ strategy, token, onClose }) {
  const [activeTab, setActiveTab] = useState('trade');
  const [tradeLogs, setTradeLogs] = useState([]);
  const [detailLogs, setDetailLogs] = useState([]);

  useEffect(() => {
    if (!strategy) return;
    const fetchLogs = () => {
      fetch(`http://localhost:8000/strategy/${strategy.id}/logs?log_type=trade`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setTradeLogs(data.logs || []))
        .catch(() => setTradeLogs([]));
      fetch(`http://localhost:8000/strategy/${strategy.id}/logs?log_type=detail`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setDetailLogs(data.logs || []))
        .catch(() => setDetailLogs([]));
    };
    fetchLogs();
    const id = setInterval(fetchLogs, 2000);
    return () => clearInterval(id);
  }, [strategy, token]);

  const parseTradeLog = (log) => {
    const m = log.match(/(BUY|SELL)\s+(\w+)\s+qty\s+([\d.]+)/i);
    if (!m) return { type: '', pair: '', qty: '', raw: log };
    return { type: m[1].toUpperCase(), pair: m[2].toUpperCase(), qty: m[3] };
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Logs: {strategy.name}</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-800 dark:text-white hover:bg-black/10 dark:hover:bg-white/20">✕</button>
        </div>
        <div className="flex border-b border-gray-400/20 dark:border-white/20 mb-4">
          <button
            onClick={() => setActiveTab('trade')}
            className={`px-4 py-2 text-sm font-semibold transition ${activeTab === 'trade' ? 'border-b-2 border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Trade Logs
          </button>
          <button
            onClick={() => setActiveTab('detail')}
            className={`px-4 py-2 text-sm font-semibold transition ${activeTab === 'detail' ? 'border-b-2 border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Detail Logs
          </button>
        </div>
        <div className="flex-grow overflow-y-auto">
          {activeTab === 'trade' && (
            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
              <thead className="border-b border-gray-400/20 dark:border-white/20 text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="p-2">Type</th>
                  <th className="p-2">Pair</th>
                  <th className="p-2">Qty</th>
                </tr>
              </thead>
              <tbody>
                {tradeLogs.map((log, i) => {
                  const t = parseTradeLog(log);
                  return (
                    <tr key={i} className="border-b border-gray-400/10 dark:border-white/10">
                      <td className={`p-2 font-bold ${t.type === 'BUY' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{t.type || log}</td>
                      <td className="p-2">{t.pair}</td>
                      <td className="p-2">{t.qty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {activeTab === 'detail' && (
            <div className="font-mono text-xs bg-gray-200/50 dark:bg-black/20 p-4 rounded-lg h-full">
              {detailLogs.map((log, i) => {
                const isConfirm = log.includes('CONFIRMED');
                const isError = log.includes('ERROR');
                const isStart = log.includes('started');
                let logColor = 'text-gray-700 dark:text-gray-400';
                if (isConfirm) logColor = 'text-green-600 dark:text-green-400';
                if (isError) logColor = 'text-red-600 dark:text-red-400';
                if (isStart) logColor = 'text-cyan-600 dark:text-cyan-400';
                return (
                  <p key={i} className={logColor}>{log}</p>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
