import { useState, useEffect } from 'react';
import GlassCard from '../components/GlassCard';
import LogModal from '../components/LogModal';
import { toast } from 'react-hot-toast';

const STRATEGY_INFO = {
  squeeze_breakout_btc_4h: {
    description:
      'Monitors Bollinger Bands and Keltner Channels to trade breakouts from low-volatility squeezes.',
    symbol: 'BTC/USDT',
    successRate: 82.4,
  },
  squeeze_breakout_xrp_1h: {
    description: 'Breakout strategy on XRP 1H timeframe.',
    symbol: 'XRP/USDT',
    successRate: 72.1,
  },
  squeeze_breakout_doge_1h: {
    description: 'Breakout strategy on DOGE 1H timeframe.',
    symbol: 'DOGE/USDT',
    successRate: 65.3,
  },
  squeeze_breakout_sol_4h: {
    description: 'Breakout strategy on SOL 4H timeframe.',
    symbol: 'SOL/USDT',
    successRate: 71.5,
  },
  hyper_frequency_ema_cross_btc_1m: {
    description:
      'A high-frequency strategy using short-term EMA crossovers to scalp profits.',
    symbol: 'BTC/USDT',
    successRate: 76.1,
  },
  continuous_trend_rider_xrp_1m: {
    description:
      'Follows strong, established trends on the 1-minute chart for XRP, aiming for quick, small gains.',
    symbol: 'XRP/USDT',
    successRate: 68.9,
  },
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState([]);
  const [tradeAmounts, setTradeAmounts] = useState({});
  const [selected, setSelected] = useState(null);
  const token = localStorage.getItem('token');

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

  const toggleStrategy = (id, running) => {
    const endpoint = running ? `/strategy/${id}/stop` : `/strategy/${id}/start`;
    const amount = tradeAmounts[id];
    if (!running && (!amount || amount.trim() === '')) {
      toast.error('Please enter the trade amount');
      return;
    }
    const options = { method: 'POST', headers: { Authorization: `Bearer ${token}` } };
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
        {strategies.map((s) => {
          const info = STRATEGY_INFO[s.id] || {};
          const status = s.running ? 'Active' : 'Inactive';
          return (
            <GlassCard key={s.id}>
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{s.name}</h3>
                <span className={`px-3 py-1 text-xs rounded-full ${s.running ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>{status}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{info.description}</p>
              <div className="mt-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Symbol</p>
                  <p className="font-semibold text-gray-700 dark:text-white">{info.symbol || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-gray-700 dark:text-white">{tradeAmounts[s.id] || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                  <p className="font-semibold text-cyan-500 dark:text-cyan-400">{info.successRate ? `${info.successRate}%` : '--'}</p>
                </div>
              </div>
              <div className="mt-6 flex space-x-2">
                {s.running ? (
                  <button
                    onClick={() => toggleStrategy(s.id, true)}
                    className="w-full py-2 rounded-lg font-bold bg-red-500/80 text-white"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => toggleStrategy(s.id, false)}
                    className="w-full py-2 rounded-lg font-bold bg-green-500/80 text-white"
                  >
                    Start
                  </button>
                )}
                <button
                  onClick={() => setSelected(s)}
                  className="w-full py-2 rounded-lg font-bold bg-gray-500/50 text-white"
                >
                  Logs
                </button>
              </div>
            </GlassCard>
          );
        })}
        {strategies.length === 0 && <p className="text-gray-500">No strategies found.</p>}
      </div>
      {selected && <LogModal strategy={selected} token={token} onClose={() => setSelected(null)} />}
    </main>
  );
}
