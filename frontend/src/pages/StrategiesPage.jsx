import { useState, useEffect } from 'react';
import GlassCard from '../components/GlassCard';
import { toast } from 'react-hot-toast';

// Map strategy id to traded symbol (for display purposes)
const SYMBOL_MAP = {
  squeeze_breakout_btc_4h: 'BTC/USDT',
  squeeze_breakout_xrp_1h: 'XRP/USDT',
  squeeze_breakout_doge_1h: 'DOGE/USDT',
  squeeze_breakout_sol_4h: 'SOL/USDT',
  hyper_frequency_ema_cross_btc_1m: 'BTC/USDT',
  continuous_trend_rider_xrp_1m: 'XRP/USDT',
};

function LogModal({ strategy, token, onClose }) {
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
            Logs: {strategy.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-800 dark:text-white hover:bg-black/10 dark:hover:bg-white/20"
          >
            ✕
          </button>
        </div>
        <div className="flex border-b border-gray-400/20 dark:border-white/20 mb-4">
          <button
            onClick={() => setActiveTab('trade')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'trade'
                ? 'border-b-2 border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Trade Logs
          </button>
          <button
            onClick={() => setActiveTab('detail')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'detail'
                ? 'border-b-2 border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Detail Logs
          </button>
        </div>
        <div className="flex-grow overflow-y-auto">
          {activeTab === 'trade' && (
            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
              <thead className="border-b border-gray-400/20 dark:border-white/20 text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="p-2">Time</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Signal</th>
                  <th className="p-2">Pair</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {tradeLogs.map((log, i) => (
                  <tr key={i} className="border-b border-gray-400/10 dark:border-white/10">
                    <td className="p-2">{log.time}</td>
                    <td
                      className={`p-2 font-bold ${
                        log.type === 'BUY' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {log.type}
                    </td>
                    <td
                      className={`p-2 font-semibold ${
                        log.signal === 'CONFIRMED' ? 'text-cyan-500 dark:text-cyan-400' : 'text-yellow-500 dark:text-yellow-400'
                      }`}
                    >
                      {log.signal}
                    </td>
                    <td className="p-2">{log.pair}</td>
                    <td className="p-2">{log.qty}</td>
                    <td className="p-2">${log.price?.toLocaleString()}</td>
                  </tr>
                ))}
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
                  <p key={i} className={logColor}>
                    {log}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default function StrategiesPage({ token }) {
  const [strategies, setStrategies] = useState([]);
  const [tradeAmounts, setTradeAmounts] = useState({});
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  token = token || localStorage.getItem('token');

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('runningStrategyAmounts') || '{}');
    fetch('http://localhost:8000/strategies', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setStrategies(data.strategies || []);
        const updated = { ...stored };
        (data.strategies || []).forEach((s) => {
          if (!s.running) delete updated[s.id];
        });
        setTradeAmounts(updated);
        localStorage.setItem('runningStrategyAmounts', JSON.stringify(updated));
      })
      .catch(() => {
        setStrategies([]);
        setTradeAmounts(stored);
      });
  }, [token]);

  const handleToggleStrategy = (id, running) => {
    const endpoint = running ? `/strategy/${id}/stop` : `/strategy/${id}/start`;
    const amount = tradeAmounts[id];
    if (!running && (!amount || amount.trim() === '')) {
      toast.error('Please enter the trade amount');
      return;
    }
    const options = {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    };
    if (!running) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify({ amount: parseFloat(amount) });
    }
    fetch(`http://localhost:8000${endpoint}`, options)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setStrategies((prev) => prev.map((s) => (s.id === id ? { ...s, running: !running } : s)));
        if (!running) {
          const updated = { ...tradeAmounts, [id]: amount };
          setTradeAmounts(updated);
          localStorage.setItem('runningStrategyAmounts', JSON.stringify(updated));
        } else {
          const updated = { ...tradeAmounts };
          delete updated[id];
          setTradeAmounts(updated);
          localStorage.setItem('runningStrategyAmounts', JSON.stringify(updated));
        }
      })
      .catch(() => toast.error('Error executing strategy'));
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Strategy Management</h2>
        <p className="text-gray-600 dark:text-gray-400">Execute available strategies.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {strategies.map((s) => (
          <GlassCard key={s.id}>
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{s.name}</h3>
              <span className={`px-3 py-1 text-xs rounded-full ${s.running ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>{s.running ? 'Active' : 'Inactive'}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{s.id.replace(/_/g, ' ')}</p>
            <div className="mt-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Symbol</p>
                <p className="font-semibold text-gray-700 dark:text-white">{SYMBOL_MAP[s.id] || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                {s.running ? (
                  <p className="font-semibold text-gray-700 dark:text-white">{tradeAmounts[s.id]}</p>
                ) : (
                  <input
                    type="number"
                    placeholder="Amount"
                    value={tradeAmounts[s.id] || ''}
                    onChange={(e) => setTradeAmounts({ ...tradeAmounts, [s.id]: e.target.value })}
                    className="w-24 px-2 py-1 border rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                <p className="font-semibold text-cyan-500 dark:text-cyan-400">N/A</p>
              </div>
            </div>
            <div className="mt-6 flex space-x-2">
              <button
                onClick={() => handleToggleStrategy(s.id, s.running)}
                className={`w-full py-2 rounded-lg font-bold transition-all ${s.running ? 'bg-red-500/80 text-white' : 'bg-green-500/80 text-white'}`}
              >
                {s.running ? 'Stop' : 'Start'}
              </button>
              <button
                onClick={() => setSelectedStrategy(s)}
                className="w-full py-2 rounded-lg font-bold bg-gray-500/50 text-white"
              >
                Logs
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
      {selectedStrategy && (
        <LogModal
          strategy={selectedStrategy}
          token={token}
          onClose={() => setSelectedStrategy(null)}
        />
      )}
    </main>
  );
}
