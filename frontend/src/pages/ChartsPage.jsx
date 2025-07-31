import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import GlassCard from '../components/GlassCard';

const intervalMap = { '15M': '15m', '1H': '1h', '4H': '4h', '1D': '1d' };

const MarketInfo = ({ data }) => (
  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
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

export default function ChartsPage({ theme }) {
  const chartRef = useRef();
  const chartInstance = useRef(null);
  const lineSeries = useRef(null);
  const candleSeries = useRef(null);
  const volumeSeries = useRef(null);

  const availablePairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
  const intervals = ['15M', '1H', '4H', '1D'];
  const [activePair, setActivePair] = useState(availablePairs[0]);
  const [activeInterval, setActiveInterval] = useState('1H');
  const [chartType, setChartType] = useState('candle');
  const [info, setInfo] = useState({ price: 0, change: 0, high: 0, low: 0, volume: 0 });

  // init chart
  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.remove();
    const chart = createChart(chartRef.current, {
      layout: {
        textColor: theme === 'dark' ? '#ffffff' : '#000000',
        background: { type: 'solid', color: 'transparent' },
      },
      width: chartRef.current.clientWidth,
      height: 400,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: {
        vertLines: { color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        horzLines: { color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
      },
    });
    const lSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, visible: chartType === 'line' });
    const cSeries = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
      visible: chartType === 'candle',
    });
    const vSeries = chart.addHistogramSeries({
      color: '#888',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    chartInstance.current = chart;
    lineSeries.current = lSeries;
    candleSeries.current = cSeries;
    volumeSeries.current = vSeries;
    const handleResize = () => {
      chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartInstance.current = null;
      lineSeries.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
    };
  }, [theme, chartType]);

  const fetchData = useCallback(async () => {
    if (!lineSeries.current || !candleSeries.current || !volumeSeries.current) return;
    try {
      const symbol = activePair.replace('/', '');
      const interval = intervalMap[activeInterval];
      const kRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`).then(r => r.json());
      const tRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(r => r.json());
      const candles = kRes.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
      const volumes = kRes.map(k => ({ time: k[0] / 1000, value: +k[5], color: +k[4] >= +k[1] ? '#16a34a' : '#dc2626' }));
      const line = kRes.map(k => ({ time: k[0] / 1000, value: +k[4] }));
      if (!lineSeries.current || !candleSeries.current || !volumeSeries.current || !chartInstance.current) return;
      candleSeries.current.setData(candles);
      lineSeries.current.setData(line);
      volumeSeries.current.setData(volumes);
      setInfo({
        price: +tRes.lastPrice,
        change: +tRes.priceChangePercent,
        high: +tRes.highPrice,
        low: +tRes.lowPrice,
        volume: +tRes.volume,
      });
      if (chartInstance.current) {
        chartInstance.current.timeScale().fitContent();
      }
    } catch (err) {
      console.error(err);
    }
  }, [activePair, activeInterval]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if (!lineSeries.current || !candleSeries.current) return;
    lineSeries.current.applyOptions({ visible: chartType === 'line' });
    candleSeries.current.applyOptions({ visible: chartType === 'candle' });
  }, [chartType]);

  const resetZoom = () => {
    if (chartInstance.current) chartInstance.current.timeScale().fitContent();
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-4">
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0 mb-4">
          <select value={activePair} onChange={e => setActivePair(e.target.value)} className="p-2 rounded-md bg-black/5 dark:bg-white/10">
            {availablePairs.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={activeInterval} onChange={e => setActiveInterval(e.target.value)} className="p-2 rounded-md bg-black/5 dark:bg-white/10">
            {intervals.map(i => <option key={i}>{i}</option>)}
          </select>
          <select value={chartType} onChange={e => setChartType(e.target.value)} className="p-2 rounded-md bg-black/5 dark:bg-white/10">
            <option value="candle">Candles</option>
            <option value="line">Line</option>
          </select>
          <button onClick={resetZoom} className="px-3 py-1 bg-black/10 dark:bg-white/20 rounded-md ml-auto">Reset Zoom</button>
        </div>
        <div ref={chartRef} />
      </GlassCard>
      <GlassCard>
        <MarketInfo data={info} />
      </GlassCard>
    </main>
  );
}

