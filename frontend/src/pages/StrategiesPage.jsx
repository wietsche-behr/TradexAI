import { useState, useEffect } from 'react';
import { PlayCircle } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { toast } from 'react-hot-toast';

export default function StrategiesPage({ setPage, setLogStrategy }) {
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('buy');
  const [strategies, setStrategies] = useState([]);
  const [tradeAmounts, setTradeAmounts] = useState({});
  const [tradeLogs, setTradeLogs] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:8000/strategies', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setStrategies(data.strategies || []))
      .catch(() => setStrategies([]));
  }, [token]);

  useEffect(() => {
    const fetchLogs = () => {
      fetch('http://localhost:8000/trade_logs', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setTradeLogs(data.logs || []))
        .catch(() => setTradeLogs([]));
    };
    fetchLogs();
    const id = setInterval(fetchLogs, 2000);
    return () => clearInterval(id);
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

  const toggleStrategy = (id, running) => {
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
        setStrategies((prev) =>
          prev.map((s) => (s.id === id ? { ...s, running: !running } : s))
        );
      })
      .catch(() => toast.error('Error executing strategy'));
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Strategy Management</h2>
        <p className="text-gray-600 dark:text-gray-400">Execute available strategies.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Available Strategies</h3>
          <div className="border-b border-gray-400/20 dark:border-white/20 pb-4 space-y-2">
            <h4 className="font-medium text-gray-700 dark:text-gray-200">Test Strategy</h4>
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
              className={`w-full py-2 rounded-lg text-white font-bold flex items-center justify-center space-x-2 shadow-lg ${buttonColor}`}
            >
              <PlayCircle size={18} />
              <span>{mode === 'buy' ? 'BUY' : 'SELL'}</span>
            </button>
          </div>
          {strategies.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border-b border-gray-400/20 dark:border-white/20 pb-2 last:border-b-0"
            >
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {s.name}
              </span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={tradeAmounts[s.id] || ''}
                  onChange={(e) =>
                    setTradeAmounts({ ...tradeAmounts, [s.id]: e.target.value })
                  }
                  className="w-24 px-2 py-1 border rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white"
                />
                <button
                  onClick={() => toggleStrategy(s.id, s.running)}
                  className={`px-3 py-1 rounded-md text-white text-sm ${s.running ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  {s.running ? 'Stop' : 'Start'}
                </button>
                <button
                  onClick={() => {
                    setLogStrategy(s.id);
                    setPage('strategy_logs');
                  }}
                  className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
                >
                  Logs
                </button>
              </div>
            </div>
          ))}
          {strategies.length === 0 && (
            <p className="text-gray-500">No strategies found.</p>
          )}
        </GlassCard>
        <GlassCard className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Trade Logs</h3>
          <div className="space-y-1 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
            {tradeLogs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
