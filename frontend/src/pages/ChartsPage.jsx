import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  ReferenceDot,
  BarChart,
} from 'recharts';
import {
  ZoomIn,
  ArrowUpCircle,
  ArrowDownCircle,
  LineChart,
  CandlestickChart,
  ChevronDown,
} from 'lucide-react';
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

const CandleStickShape = ({ x, y, width, height, payload }) => {
  const fill = payload.isBullish ? '#22c55e' : '#ef4444';
  return <rect x={x} y={y} width={width} height={height} fill={fill} />;
};

const WickShape = ({ x, y, width, height, payload }) => {
  const fill = payload.isBullish ? '#22c55e' : '#ef4444';
  return <rect x={x + width / 2 - 0.5} y={y} width={1} height={height} fill={fill} />;
};

const intervalMap = { '15M': '15m', '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w' };

export default function ChartsPage({ theme }) {
  const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];
  const [activePair, setActivePair] = useState('BTC/USDT');
  const [activeInterval, setActiveInterval] = useState('1H');
  const [chartType, setChartType] = useState('line');
  const [activeTool, setActiveTool] = useState('none');
  const [buyMarker, setBuyMarker] = useState(null);
  const [sellMarker, setSellMarker] = useState(null);
  const [zoomState, setZoomState] = useState({});
  const [crosshair, setCrosshair] = useState(null);
  const [marketData, setMarketData] = useState({});

  const currentMarketData = marketData[activePair] || {
    price: 0,
    change: 0,
    high: 0,
    low: 0,
    volume: 0,
    lineData: [],
    candleData: [],
  };

  const fetchMarket = async () => {
    try {
      const symbol = activePair.replace('/', '');
      const interval = intervalMap[activeInterval];
      const [kRes, tRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`).then(r => r.json()),
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(r => r.json()),
      ]);
      const lineData = kRes.map((k, idx) => ({
        time: idx,
        price: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
      const candleData = kRes.map((k, idx) => ({
        time: idx,
        wick: [parseFloat(k[3]), parseFloat(k[2])],
        body: [parseFloat(k[1]), parseFloat(k[4])],
        volume: parseFloat(k[5]),
        isBullish: parseFloat(k[4]) >= parseFloat(k[1]),
      }));
      const info = {
        price: parseFloat(tRes.lastPrice),
        change: parseFloat(tRes.priceChangePercent),
        high: parseFloat(tRes.highPrice),
        low: parseFloat(tRes.lowPrice),
        volume: parseFloat(tRes.volume),
        lineData,
        candleData,
      };
      setMarketData(prev => ({ ...prev, [activePair]: info }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMarket();
    const id = setInterval(fetchMarket, 60000);
    return () => clearInterval(id);
  }, [activePair, activeInterval]);

  const chartData = chartType === 'line' ? currentMarketData.lineData : currentMarketData.candleData;

  const zoom = () => {
    let { refAreaLeft, refAreaRight } = zoomState;
    if (refAreaLeft === refAreaRight || refAreaRight === '') {
      setZoomState({ refAreaLeft: '', refAreaRight: '' });
      return;
    }
    if (refAreaLeft > refAreaRight) [refAreaLeft, refAreaRight] = [refAreaRight, refAreaLeft];
    setZoomState({ ...zoomState, left: refAreaLeft, right: refAreaRight });
  };

  const resetZoom = () => setZoomState({});

  const handleChartClick = (e) => {
    if (!e || !e.activeLabel) return;
    const { activeLabel, activePayload } = e;
    const price = chartType === 'line' ? activePayload[0].payload.price : activePayload[0].payload.body[1];

    if (activeTool === 'buy') setBuyMarker({ time: activeLabel, price });
    if (activeTool === 'sell') setSellMarker({ time: activeLabel, price });
  };

  const axisColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const priceColor = currentMarketData.change >= 0 ? '#22c55e' : '#ef4444';

  const yDomain = chartType === 'candle'
    ? [Math.min(...currentMarketData.candleData.map(d => d.wick[0] || 0)), Math.max(...currentMarketData.candleData.map(d => d.wick[1] || 0))]
    : ['auto', 'auto'];

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <GlassCard className="mb-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="relative">
            <select
              value={activePair}
              onChange={(e) => setActivePair(e.target.value)}
              className="appearance-none pr-8 px-3 py-2 text-sm rounded-md bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {pairs.map((pair) => (
                <option key={pair} value={pair}>{pair}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400" size={16} />
          </div>
          <MarketInfo data={currentMarketData} />
        </div>
      </GlassCard>

      <div className="flex gap-6">
        <GlassCard className="p-2 self-start">
          <div className="flex flex-col gap-1">
            {[{ tool: 'zoom', icon: ZoomIn }, { tool: 'buy', icon: ArrowUpCircle }, { tool: 'sell', icon: ArrowDownCircle }].map(({ tool, icon: Icon }) => (
              <button
                key={tool}
                onClick={() => setActiveTool(activeTool === tool ? 'none' : tool)}
                className={`p-2 rounded-md ${activeTool === tool ? 'bg-cyan-500/30 text-cyan-400' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="flex-grow">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-1">
              {['15M', '1H', '4H', '1D', '1W'].map(interval => (
                <button
                  key={interval}
                  onClick={() => setActiveInterval(interval)}
                  className={`px-3 py-1 text-xs rounded-md ${activeInterval === interval ? 'bg-black/10 dark:bg-white/20' : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400'}`}
                >
                  {interval}
                </button>
              ))}
            </div>
            {zoomState.left && (
              <button onClick={resetZoom} className="px-3 py-1 text-xs rounded-md bg-cyan-500/30 text-cyan-400">Reset Zoom</button>
            )}
            <div className="flex items-center space-x-1 bg-black/5 dark:bg-white/10 p-1 rounded-md">
              <button onClick={() => setChartType('line')} className={`p-1.5 rounded ${chartType === 'line' ? 'bg-white/20' : ''}`}><LineChart size={18} /></button>
              <button onClick={() => setChartType('candle')} className={`p-1.5 rounded ${chartType === 'candle' ? 'bg-white/20' : ''}`}><CandlestickChart size={18} /></button>
            </div>
          </div>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={chartData}
                syncId="anyId"
                onMouseDown={(e) => activeTool === 'zoom' && e && setZoomState({ ...zoomState, refAreaLeft: e.activeLabel })}
                onMouseMove={(e) => {
                  if (zoomState.refAreaLeft && activeTool === 'zoom' && e) {
                    setZoomState({ ...zoomState, refAreaRight: e.activeLabel });
                  }
                  if (e && e.activeLabel != null && e.activePayload) {
                    const price = chartType === 'line'
                      ? e.activePayload[0].payload.price
                      : e.activePayload[0].payload.body[1];
                    setCrosshair({ x: e.activeLabel, y: price });
                  } else {
                    setCrosshair(null);
                  }
                }}
                onMouseLeave={() => setCrosshair(null)}
                onMouseUp={activeTool === 'zoom' ? zoom : undefined}
                onClick={handleChartClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="time" type="number" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} domain={[zoomState.left || 'dataMin', zoomState.right || 'dataMax']} allowDataOverflow />
                <YAxis orientation="right" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} tickFormatter={(value) => value.toLocaleString()} tickLine={false} axisLine={false} domain={yDomain} allowDataOverflow />
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? 'rgba(20, 20, 40, 0.8)' : 'rgba(255, 255, 255, 0.8)', borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px' }} />
                {chartType === 'line' ? (
                  <Area type="monotone" dataKey="price" stroke={priceColor} strokeWidth={2} fill={`url(#priceGradient${priceColor})`} name="Price" />
                ) : (
                  <>
                    <Bar dataKey="wick" shape={<WickShape />} />
                    <Bar dataKey="body" shape={<CandleStickShape />} />
                  </>
                )}
                <defs>
                  <linearGradient id={`priceGradient${priceColor}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={priceColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {zoomState.refAreaLeft && zoomState.refAreaRight ? (
                  <ReferenceArea x1={zoomState.refAreaLeft} x2={zoomState.refAreaRight} strokeOpacity={0.3} />
                ) : null}
                {crosshair && (
                  <>
                    <ReferenceLine x={crosshair.x} stroke={axisColor} strokeDasharray="3 3" />
                    <ReferenceLine y={crosshair.y} stroke={axisColor} strokeDasharray="3 3" />
                  </>
                )}
                {buyMarker && (
                  <ReferenceDot x={buyMarker.time} y={buyMarker.price} r={4} fill="#22c55e" stroke="none" />
                )}
                {sellMarker && (
                  <ReferenceDot x={sellMarker.time} y={sellMarker.price} r={4} fill="#ef4444" stroke="none" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ width: '100%', height: 100 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} syncId="anyId">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="time" type="number" hide domain={[zoomState.left || 'dataMin', zoomState.right || 'dataMax']} allowDataOverflow />
                <YAxis orientation="right" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? 'rgba(20, 20, 40, 0.8)' : 'rgba(255, 255, 255, 0.8)', borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px' }} />
                <Bar dataKey="volume" fill={theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'} name="Volume" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

