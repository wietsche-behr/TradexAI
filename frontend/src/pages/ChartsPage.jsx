import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import GlassCard from '../components/GlassCard';

const intervalMap = { '5M': '5m', '15M': '15m', '1H': '1h', '4H': '4h', '1D': '1d' };

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
  const overlayRef = useRef(null);
  const startPoint = useRef(null);

  const [tool, setTool] = useState('none'); // none | measure | line
  const [tempLine, setTempLine] = useState(null);
  const [lines, setLines] = useState([]);
  const [measureText, setMeasureText] = useState(null);

  const availablePairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT'];
  const intervals = ['5M', '15M', '1H', '4H', '1D'];
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
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0, bottom: 0.3 },
      },
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
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
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

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;

    const mouseDown = (e) => {
      if (tool === 'line' || tool === 'measure') {
        const rect = container.getBoundingClientRect();
        startPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };

    const mouseMove = (e) => {
      if (!startPoint.current) return;
      const rect = container.getBoundingClientRect();
      const x2 = e.clientX - rect.left;
      const y2 = e.clientY - rect.top;
      setTempLine({
        x1: startPoint.current.x,
        y1: startPoint.current.y,
        x2,
        y2,
      });
      if (tool === 'measure' && chartInstance.current) {
        const chart = chartInstance.current;
        const t1 = chart.timeScale().coordinateToTime(startPoint.current.x);
        const t2 = chart.timeScale().coordinateToTime(x2);
        const p1 = chart.priceScale('right').coordinateToPrice(startPoint.current.y);
        const p2 = chart.priceScale('right').coordinateToPrice(y2);
        if (t1 && t2 && p1 && p2) {
          const diffP = (p2 - p1).toFixed(2);
          const diffT = Math.abs(t2 - t1);
          setMeasureText({ x: x2 + 10, y: y2, text: `${diffP} / ${diffT}` });
        }
      }
    };

    const mouseUp = (e) => {
      if (!startPoint.current) return;
      const rect = container.getBoundingClientRect();
      const newLine = {
        x1: startPoint.current.x,
        y1: startPoint.current.y,
        x2: e.clientX - rect.left,
        y2: e.clientY - rect.top,
      };
      if (tool === 'line') {
        setLines((prev) => [...prev, newLine]);
      }
      startPoint.current = null;
      setTempLine(null);
      setMeasureText(null);
      if (tool === 'measure') {
        setTimeout(() => setTool('none'), 0);
      }
    };

    container.addEventListener('mousedown', mouseDown);
    container.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseUp);

    return () => {
      container.removeEventListener('mousedown', mouseDown);
      container.removeEventListener('mousemove', mouseMove);
      window.removeEventListener('mouseup', mouseUp);
    };
  }, [tool]);

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
        <div className="relative" ref={chartRef}>
          <svg ref={overlayRef} className="absolute inset-0 pointer-events-none z-10">
            {tempLine && (
              <line x1={tempLine.x1} y1={tempLine.y1} x2={tempLine.x2} y2={tempLine.y2} stroke="yellow" strokeDasharray="4" />
            )}
            {lines.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="cyan" />
            ))}
            {measureText && (
              <text x={measureText.x} y={measureText.y} fill="yellow" fontSize="12">{measureText.text}</text>
            )}
          </svg>
          <div className="absolute left-2 top-2 flex flex-col space-y-2 z-20">
            <button onClick={() => setTool(tool === 'measure' ? 'none' : 'measure')} className={`p-1 rounded-md ${tool === 'measure' ? 'bg-cyan-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>📏</button>
            <button onClick={() => setTool(tool === 'line' ? 'none' : 'line')} className={`p-1 rounded-md ${tool === 'line' ? 'bg-cyan-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>✏️</button>
          </div>
        </div>
      </GlassCard>
      <GlassCard>
        <MarketInfo data={info} />
      </GlassCard>
    </main>
  );
}

