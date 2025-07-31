import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import GlassCard from '../components/GlassCard';

const MarketInfo = ({ data }) => (
  <div className="flex-grow grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
      <p className={`text-lg font-semibold ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>{data.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h Change</p>
      <p className={`text-lg font-semibold ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>{data.change > 0 ? '+' : ''}{data.change}%</p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h High</p>
      <p className="text-lg font-semibold text-gray-800 dark:text-white">{data.high.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h Low</p>
      <p className="text-lg font-semibold text-gray-800 dark:text-white">{data.low.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h Volume</p>
      <p className="text-lg font-semibold text-gray-800 dark:text-white">{(data.volume / 1000).toFixed(1)}k</p>
    </div>
  </div>
);

const intervalMap = { '15M': '15', '1H': '60', '4H': '240', '1D': 'D', '1W': 'W' };

export default function ChartsPage({ theme }) {
  const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];
  const [activePair, setActivePair] = useState('BTC/USDT');
  const [activeInterval, setActiveInterval] = useState('1H');
  const [info, setInfo] = useState(null);
  const [tvReady, setTvReady] = useState(false);
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (window.TradingView) {
      setTvReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.onload = () => setTvReady(true);
    document.body.appendChild(script);
  }, []);

  const fetchMarket = () => {
    const symbol = activePair.replace('/', '');
    fetch(`http://localhost:8000/klines?pair=${symbol}&interval=${intervalMap[activeInterval]}`)
      .then(r => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  };

  useEffect(() => {
    fetchMarket();
    const id = setInterval(fetchMarket, 60000);
    return () => clearInterval(id);
  }, [activePair, activeInterval]);

  useEffect(() => {
    if (!tvReady) return;
    if (widgetRef.current) {
      widgetRef.current.remove();
    }
    const symbol = activePair.replace('/', '');
    widgetRef.current = new window.TradingView.widget({
      symbol,
      interval: intervalMap[activeInterval],
      container_id: containerRef.current,
      width: '100%',
      height: 500,
      theme,
      locale: 'en',
      withdateranges: true,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      allow_symbol_change: false,
    });
  }, [tvReady, activePair, activeInterval, theme]);

  const data = info || { price: 0, change: 0, high: 0, low: 0, volume: 0 };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <GlassCard className="mb-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="relative">
            <select
              value={activePair}
              onChange={e => setActivePair(e.target.value)}
              className="pr-8 px-3 py-2 text-sm rounded-md bg-transparent border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              {pairs.map(pair => (
                <option key={pair} value={pair}>{pair}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400" size={16} />
          </div>
          <MarketInfo data={data} />
        </div>
      </GlassCard>
      <GlassCard>
        <div className="flex items-center space-x-1 mb-4">
          {Object.keys(intervalMap).map(interval => (
            <button
              key={interval}
              onClick={() => setActiveInterval(interval)}
              className={`px-3 py-1 text-xs rounded-md ${activeInterval === interval ? 'bg-cyan-500/30 text-cyan-600 dark:text-cyan-400' : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400'}`}
            >
              {interval}
            </button>
          ))}
        </div>
        <div ref={containerRef} className="w-full h-[500px]" />
      </GlassCard>
    </main>
  );
}
