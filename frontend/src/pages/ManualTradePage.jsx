import { useState, useEffect, useRef } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CandlestickChart, LineChart, Target } from 'lucide-react';
import GlassCard from '../components/GlassCard';

// --- MOCK DATA GENERATION ---
const generateLineChartData = (basePrice, points) => {
  const data = [];
  let price = basePrice;
  for (let i = 0; i < points; i++) {
    const fluct = (Math.random() - 0.5) * basePrice * 0.05;
    price += fluct;
    const volume = Math.random() * 1000 + 200;
    data.push({
      time: i,
      price: parseFloat(price.toFixed(2)),
      volume: parseFloat(volume.toFixed(2)),
    });
  }
  return data;
};

const generateCandleChartData = (basePrice, points) => {
  const data = [];
  let lastClose = basePrice;
  for (let i = 0; i < points; i++) {
    const open = parseFloat((lastClose * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2));
    const high = parseFloat((Math.max(open, lastClose) * (1 + Math.random() * 0.015)).toFixed(2));
    const low = parseFloat((Math.min(open, lastClose) * (1 - Math.random() * 0.015)).toFixed(2));
    const close = parseFloat((low + Math.random() * (high - low)).toFixed(2));
    const volume = Math.random() * 1000 + 200;
    data.push({
      time: i,
      wick: [low, high],
      body: [open, close],
      volume: parseFloat(volume.toFixed(2)),
      isBullish: close >= open,
    });
    lastClose = close;
  }
  return data;
};

const marketData = {
  'BTC/USDT': {
    price: 68530.45,
    change: 2.5,
    high: 69100.0,
    low: 67800.0,
    volume: 45000,
    lineData: generateLineChartData(68530, 200),
    candleData: generateCandleChartData(68530, 200),
  },
  'ETH/USDT': {
    price: 3550.12,
    change: -1.2,
    high: 3600.0,
    low: 3520.0,
    volume: 250000,
    lineData: generateLineChartData(3550, 200),
    candleData: generateCandleChartData(3550, 200),
  },
  'SOL/USDT': {
    price: 167.8,
    change: 5.8,
    high: 172.5,
    low: 165.2,
    volume: 850000,
    lineData: generateLineChartData(167, 200),
    candleData: generateCandleChartData(167, 200),
  },
};

// --- HELPER COMPONENTS ---
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

const DraggableLabel = ({ viewBox, onMouseDown, text, color }) => {
  const { x, y } = viewBox;
  return (
    <g onMouseDown={onMouseDown} style={{ cursor: 'ns-resize' }}>
      <rect x={x} y={y - 10} width="30" height="20" fill={color} rx="4" />
      <text x={x + 15} y={y + 4} textAnchor="middle" fill="white" fontSize="10">{text}</text>
    </g>
  );
};

const ChartComponent = ({
  theme,
  stopLoss,
  takeProfit,
  setStopLoss,
  setTakeProfit,
  activePair,
  setActivePair,
}) => {
  const [activeInterval, setActiveInterval] = useState('1H');
  const [chartType, setChartType] = useState('line');
  const [dragging, setDragging] = useState(null);
  const chartRef = useRef(null);
  const [xDomain, setXDomain] = useState([100, 250]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, domain: [0, 0] });

  const currentMarketData = marketData[activePair];
  const chartData = chartType === 'line' ? currentMarketData.lineData : currentMarketData.candleData;

  useEffect(() => {
    setXDomain([100, 250]);
  }, [activePair, chartType]);

  const handleMouseMove = (e) => {
    if (dragging && chartRef.current && e && e.chartY) {
      const chartState = chartRef.current.state;
      if (chartState && chartState.yAxisMap && chartState.yAxisMap[0]) {
        const yAxis = chartState.yAxisMap[0];
        if (yAxis && typeof yAxis.scale.invert === 'function') {
          const newPrice = parseFloat(yAxis.scale.invert(e.chartY).toFixed(2));
          if (dragging === 'sl') setStopLoss(newPrice);
          if (dragging === 'tp') setTakeProfit(newPrice);
        }
      }
    }
    if (isPanning && chartRef.current && e && e.chartX) {
      const chartState = chartRef.current.state;
      const pixelDelta = e.chartX - panStart.x;
      const range = panStart.domain[1] - panStart.domain[0];
      const dataPointsPerPixel = range / chartState.chartWidth;
      const indexDelta = pixelDelta * dataPointsPerPixel;

      let newDomain = [panStart.domain[0] - indexDelta, panStart.domain[1] - indexDelta];
      if (newDomain[0] < 0) newDomain = [0, range];
      if (newDomain[1] > chartData.length - 1 + 100)
        newDomain = [chartData.length - 1 + 100 - range, chartData.length - 1 + 100];
      setXDomain(newDomain);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleDragStart = (e, type) => {
    e.stopPropagation();
    setDragging(type);
  };

  const handlePanStart = (e) => {
    if (e && !dragging) {
      setIsPanning(true);
      setPanStart({ x: e.chartX, domain: xDomain });
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const chartState = chartRef.current.state;
    if (!chartState || !e.chartX) return;
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const [start, end] = xDomain;
    const range = end - start;
    const mouseIndex = chartState.xAxisMap[0].scale.invert(e.chartX);
    const newStart = mouseIndex - (mouseIndex - start) * zoomFactor;
    const newEnd = mouseIndex + (end - mouseIndex) * zoomFactor;
    if (newEnd - newStart > 5 && newEnd - newStart < chartData.length * 2) {
      setXDomain([
        Math.max(0, newStart),
        Math.min(chartData.length - 1 + 100, newEnd),
      ]);
    }
  };

  const resetZoom = () => setXDomain([100, 250]);

  const axisColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const priceColor = currentMarketData.change >= 0 ? '#22c55e' : '#ef4444';
  const yDomain =
    chartType === 'candle'
      ? [
          Math.min(...currentMarketData.candleData.map((d) => d.wick[0])),
          Math.max(...currentMarketData.candleData.map((d) => d.wick[1])),
        ]
      : ['auto', 'auto'];

  return (
    <div
      className="flex-grow flex flex-col gap-6"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <GlassCard>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            {Object.keys(marketData).map((pair) => (
              <button
                key={pair}
                onClick={() => setActivePair(pair)}
                className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
                  activePair === pair
                    ? 'bg-cyan-500/30 text-cyan-400'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'
                }`}
              >
                {pair}
              </button>
            ))}
          </div>
          <MarketInfo data={currentMarketData} />
        </div>
      </GlassCard>
      <GlassCard className="flex-grow flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-1">
            {['15M', '1H', '4H', '1D', '1W'].map((interval) => (
              <button
                key={interval}
                onClick={() => setActiveInterval(interval)}
                className={`px-3 py-1 text-xs rounded-md ${
                  activeInterval === interval
                    ? 'bg-black/10 dark:bg-white/20'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400'
                }`}
              >
                {interval}
              </button>
            ))}
          </div>
          <button onClick={resetZoom} className="px-3 py-1 text-xs rounded-md bg-cyan-500/30 text-cyan-400">Reset View</button>
          <div className="flex items-center space-x-1 bg-black/5 dark:bg-white/10 p-1 rounded-md">
            <button onClick={() => setChartType('line')} className={`p-1.5 rounded ${chartType === 'line' ? 'bg-white/20' : ''}`}><LineChart size={18} /></button>
            <button onClick={() => setChartType('candle')} className={`p-1.5 rounded ${chartType === 'candle' ? 'bg-white/20' : ''}`}><CandlestickChart size={18} /></button>
          </div>
        </div>
        <div className="flex-grow" style={{ cursor: isPanning ? 'grabbing' : 'grab' }} onWheel={handleWheel}>
          <ResponsiveContainer>
            <ComposedChart
              ref={chartRef}
              data={chartData}
              syncId="manualTradeChart"
              onMouseDown={handlePanStart}
              onMouseMove={handleMouseMove}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                domain={xDomain}
                allowDataOverflow
              />
              <YAxis
                orientation="right"
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 12 }}
                tickFormatter={(value) => value.toLocaleString()}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                allowDataOverflow
              />
              <Tooltip
                isAnimationActive={!dragging && !isPanning}
                contentStyle={{
                  backgroundColor: theme === 'dark' ? 'rgba(20, 20, 40, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                }}
              />
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
              {takeProfit && (
                <ReferenceLine
                  y={takeProfit}
                  stroke="#22c55e"
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  label={<DraggableLabel onMouseDown={(e) => handleDragStart(e, 'tp')} text="TP" color="#22c55e" />}
                />
              )}
              {stopLoss && (
                <ReferenceLine
                  y={stopLoss}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  label={<DraggableLabel onMouseDown={(e) => handleDragStart(e, 'sl')} text="SL" color="#ef4444" />}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
};

const ManualTradePanel = ({
  stopLoss,
  takeProfit,
  setStopLoss,
  setTakeProfit,
  isSlPlotted,
  setIsSlPlotted,
  isTpPlotted,
  setIsTpPlotted,
  currentPrice,
  activePair,
  token,
}) => {
  const [tradeType, setTradeType] = useState('buy');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(1);

  const handlePlotToggle = (type) => {
    if (type === 'tp') {
      if (isTpPlotted) {
        setIsTpPlotted(false);
        setTakeProfit('');
      } else {
        setIsTpPlotted(true);
        if (!takeProfit) setTakeProfit((currentPrice * 1.01).toFixed(2));
      }
    }
    if (type === 'sl') {
      if (isSlPlotted) {
        setIsSlPlotted(false);
        setStopLoss('');
      } else {
        setIsSlPlotted(true);
        if (!stopLoss) setStopLoss((currentPrice * 0.99).toFixed(2));
      }
    }
  };

  const total = price && amount ? (price * amount).toFixed(2) : '0.00';
  const cost = price && amount ? (price * amount / leverage).toFixed(2) : '0.00';

  const placeOrder = () => {
    if (!amount) return;
    const endpoint = tradeType === 'buy' ? '/strategy/test/buy' : '/strategy/test/sell';
    fetch(`http://localhost:8000${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbol: activePair.replace('/', ''), amount: parseFloat(amount) }),
    }).catch(() => {});
  };

  return (
    <GlassCard className="w-full lg:w-96 flex-shrink-0">
      <div className="flex mb-4">
        <button
          onClick={() => setTradeType('buy')}
          className={`w-1/2 py-2 text-center font-bold rounded-l-lg transition ${tradeType === 'buy' ? 'bg-green-500/80 text-white' : 'bg-black/10 dark:bg-white/10'}`}
        >
          Buy
        </button>
        <button
          onClick={() => setTradeType('sell')}
          className={`w-1/2 py-2 text-center font-bold rounded-r-lg transition ${tradeType === 'sell' ? 'bg-red-500/80 text-white' : 'bg-black/10 dark:bg-white/10'}`}
        >
          Sell
        </button>
      </div>
      <div className="space-y-4">
        <div className="relative">
          <label className="text-xs text-gray-500 dark:text-gray-400">Price</label>
          <input
            type="number"
            placeholder="Market"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-black/10 dark:bg-white/10 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <span className="absolute right-3 top-6 text-xs text-gray-500">USDT</span>
        </div>
        <div className="relative">
          <label className="text-xs text-gray-500 dark:text-gray-400">Amount</label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-black/10 dark:bg-white/10 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <span className="absolute right-3 top-6 text-xs text-gray-500">{activePair.split('/')[0]}</span>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Leverage: {leverage}x</label>
          <input
            type="range"
            min="1"
            max="100"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full h-2 bg-gray-500/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="relative">
          <label className="text-xs text-gray-500 dark:text-gray-400">Take Profit</label>
          <div className="flex items-center">
            <input
              type="number"
              placeholder="Optional"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full bg-black/10 dark:bg-white/10 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              onClick={() => handlePlotToggle('tp')}
              className={`p-2 ml-2 rounded-md ${isTpPlotted ? 'bg-cyan-500/30 text-cyan-400' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
            >
              <Target size={18} />
            </button>
          </div>
        </div>
        <div className="relative">
          <label className="text-xs text-gray-500 dark:text-gray-400">Stop Loss</label>
          <div className="flex items-center">
            <input
              type="number"
              placeholder="Optional"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full bg-black/10 dark:bg-white/10 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              onClick={() => handlePlotToggle('sl')}
              className={`p-2 ml-2 rounded-md ${isSlPlotted ? 'bg-cyan-500/30 text-cyan-400' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
            >
              <Target size={18} />
            </button>
          </div>
        </div>
        <div className="border-t border-gray-400/20 dark:border-white/20 my-4"></div>
        <div className="text-xs space-y-2 text-gray-600 dark:text-gray-300">
          <div className="flex justify-between">
            <span>Total:</span>
            <span>{total} USDT</span>
          </div>
          <div className="flex justify-between">
            <span>Cost:</span>
            <span>{cost} USDT</span>
          </div>
          <div className="flex justify-between">
            <span>Available:</span>
            <span>$1,250.75 USDT</span>
          </div>
        </div>
        <button
          onClick={placeOrder}
          className={`w-full py-3 mt-4 rounded-lg text-white font-bold text-lg transition-all shadow-lg ${tradeType === 'buy' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/30' : 'bg-red-500 hover:bg-red-600 shadow-red-500/30'}`}
        >
          Place {tradeType === 'buy' ? 'Buy' : 'Sell'} Order
        </button>
      </div>
    </GlassCard>
  );
};

export default function ManualTradePage({ theme, token }) {
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [isSlPlotted, setIsSlPlotted] = useState(false);
  const [isTpPlotted, setIsTpPlotted] = useState(false);
  const [activePair, setActivePair] = useState('BTC/USDT');

  return (
    <main className="p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
      <ChartComponent
        theme={theme}
        stopLoss={isSlPlotted ? stopLoss : null}
        takeProfit={isTpPlotted ? takeProfit : null}
        setStopLoss={setStopLoss}
        setTakeProfit={setTakeProfit}
        activePair={activePair}
        setActivePair={setActivePair}
      />
      <ManualTradePanel
        stopLoss={stopLoss}
        takeProfit={takeProfit}
        setStopLoss={setStopLoss}
        setTakeProfit={setTakeProfit}
        isSlPlotted={isSlPlotted}
        setIsSlPlotted={setIsSlPlotted}
        isTpPlotted={isTpPlotted}
        setIsTpPlotted={setIsTpPlotted}
        currentPrice={marketData[activePair].price}
        activePair={activePair}
        token={token}
      />
    </main>
  );
}
