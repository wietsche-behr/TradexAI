import { useState, useEffect } from 'react';
import { PlayCircle, StopCircle } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { toast } from 'react-hot-toast';

const AVAILABLE_STRATEGIES = [
  { id: 'squeeze_breakout', name: 'Squeeze Breakout' },
  { id: 'squeeze_breakout_doge_1h', name: 'DOGEUSDT 1H Squeeze Breakout' },
];

export default function StrategiesPage({ setPage, setLogStrategy }) {
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('buy');
  const [botConfig, setBotConfig] = useState(null);
  const [strategyAmounts, setStrategyAmounts] = useState({});
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:8000/bot', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setBotConfig)
      .catch(() => setBotConfig(null));
  }, [token]);

  const handleAction = () => {
    if (!symbol || !amount) return;
    const endpoint =
      mode === 'buy' ? '/strategy/test/buy' : '/strategy/test/sell';
    const payload =
      mode === 'buy'
        ? { symbol, amount: parseFloat(amount) }
        : { symbol, quantity: parseFloat(amount) };

    fetch(`http://localhost:8000${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (mode === 'buy') {
          toast.success('Bought successfully');
          const qty = data.buy?.executedQty || amount;
          setAmount(qty);
          setMode('sell');
        } else {
          toast.success('Sold successfully');
          setMode('buy');
          setAmount('');
        }
      })
      .catch(() => toast.error('Error executing order'));
  };

  const base = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol;
  const amountPlaceholder = mode === 'buy' ? 'Amount in USDT' : `Amount in ${base}`;
  const buttonColor = mode === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600';

  const updateBot = (strategy, isActive) => {
    const payload = {
      strategy,
      risk_level: botConfig?.risk_level || 'medium',
      market: botConfig?.market || 'spot',
      is_active: isActive,
      amount: parseFloat(strategyAmounts[strategy] || '0'),
    };
    fetch('http://localhost:8000/bot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        setBotConfig(data);
        toast.success(isActive ? 'Strategy started' : 'Strategy stopped');
        if (isActive) {
          fetch(`http://localhost:8000/strategy/${strategy}/run`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount: payload.amount }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => {});
        }
      })
      .catch(() => toast.error('Error updating strategy'));
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Strategy Management</h2>
        <p className="text-gray-600 dark:text-gray-400">Execute available strategies.</p>
      </div>
      <GlassCard className="max-w-md mx-auto space-y-4 mb-8">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Test Strategy</h3>
        <input
          type="text"
          placeholder="Trading pair e.g. XRPUSDT"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white"
        />
        <input
          type="text"
          placeholder={amountPlaceholder}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white"
        />
        <button
          onClick={handleAction}
          className={`w-full py-3 rounded-lg text-white font-bold text-lg flex items-center justify-center space-x-2 shadow-lg ${buttonColor}`}
        >
          <PlayCircle size={20} />
          <span>{mode === 'buy' ? 'BUY' : 'SELL'}</span>
        </button>
      </GlassCard>

      <div className="space-y-4">
        {AVAILABLE_STRATEGIES.map((s) => {
          const active = botConfig?.is_active && botConfig?.strategy === s.id;
          const amt = strategyAmounts[s.id] || '';
          return (
            <GlassCard key={s.id} className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{s.name}</h3>
                {active && <p className="text-sm text-green-500">Running</p>}
                {!active && (
                  <input
                    type="number"
                    placeholder="Trade amount"
                    value={amt}
                    onChange={(e) => setStrategyAmounts({ ...strategyAmounts, [s.id]: e.target.value })}
                    className="mt-2 px-2 py-1 w-32 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white border"
                  />
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => updateBot(s.id, !active)}
                  className={`px-4 py-2 rounded-lg text-white font-bold flex items-center space-x-2 ${active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  {active ? <StopCircle size={20} /> : <PlayCircle size={20} />}
                  <span>{active ? 'Stop' : 'Start'}</span>
                </button>
                <button
                  onClick={() => { setLogStrategy(s.id); setPage('strategy_logs'); }}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold"
                >
                  View Log
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </main>
  );
}
