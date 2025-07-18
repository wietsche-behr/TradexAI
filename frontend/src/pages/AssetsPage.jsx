import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:8000/assets', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAssets(data.balances || []))
      .catch(() => setAssets([]));
  }, [token]);

  const filtered = assets.filter(
    (a) => parseFloat(a.free) > 0 || parseFloat(a.locked) > 0
  );

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <GlassCard>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Binance Assets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-600 dark:text-gray-300">
            <thead className="border-b border-gray-400/20 dark:border-white/20">
              <tr>
                <th className="p-4">Asset</th>
                <th className="p-4 text-right">Free</th>
                <th className="p-4 text-right">Locked</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset) => (
                <tr
                  key={asset.asset}
                  className="border-b border-gray-400/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="p-4 font-semibold text-gray-800 dark:text-white">{asset.asset}</td>
                  <td className="p-4 text-right">{parseFloat(asset.free).toFixed(8)}</td>
                  <td className="p-4 text-right">{parseFloat(asset.locked).toFixed(8)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-gray-500">
                    No assets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </main>
  );
}
