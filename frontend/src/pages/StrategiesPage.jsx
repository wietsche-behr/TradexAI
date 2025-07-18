import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { toast } from 'react-hot-toast';

export default function StrategiesPage() {
  const [symbol, setSymbol] = useState('');
  const token = localStorage.getItem('token');

  const runStrategy = () => {
    if (!symbol) return;
    fetch('http://localhost:8000/strategy/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ symbol }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => toast.success('Strategy executed'))
      .catch(() => toast.error('Error executing strategy'));
  };

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
        <button
          onClick={runStrategy}
          className="w-full py-3 rounded-lg text-white font-bold text-lg bg-green-500 hover:bg-green-600 flex items-center justify-center space-x-2 shadow-lg"
        >
          <PlayCircle size={20} />
          <span>RUN STRATEGY</span>
        </button>
      </GlassCard>
    </main>
  );
}
