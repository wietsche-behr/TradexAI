import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { toast } from 'react-hot-toast';

export default function StrategiesPage() {
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('buy');
  const token = localStorage.getItem('token');

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

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Strategy Management</h2>
        <p className="text-gray-600 dark:text-gray-400">Execute available strategies.</p>
      </div>
      <GlassCard className="max-w-md mx-auto space-y-4">
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
    </main>
  );
}
