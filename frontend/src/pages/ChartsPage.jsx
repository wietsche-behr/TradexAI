import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';

const formatNum = (n) => (typeof n === 'number' ? n.toLocaleString() : 'N/A');

function MarketInfo({ data }) {
  if (!data) return null;
  return (
    <GlassCard className="mb-6">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Market Info</h3>
      <div className="grid grid-cols-2 gap-4 text-gray-700 dark:text-gray-200">
        <div>
          <p className="text-sm text-gray-500">Symbol</p>
          <p className="font-semibold">{data.symbol || 'N/A'}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Price</p>
          <p className="font-semibold">${formatNum(data.price)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Volume</p>
          <p className="font-semibold">{formatNum(data.volume)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Change 24h</p>
          <p className="font-semibold">{formatNum(data.change_24h)}</p>
        </div>
      </div>
    </GlassCard>
  );
}

export default function ChartsPage({ token }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:8000/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setInfo(data.stats))
      .catch(() => setInfo(null));
  }, [token]);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <MarketInfo data={info} />
      {/* Placeholder for future chart implementation */}
      <GlassCard className="h-64 flex items-center justify-center text-gray-500">
        Charts coming soon
      </GlassCard>
    </main>
  );
}
