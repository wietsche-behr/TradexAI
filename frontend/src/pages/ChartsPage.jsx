import { useState, useEffect, useRef, useCallback } from 'react';
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
  BarChart,
  Brush,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import {
  ZoomIn,
  ArrowUpCircle,
  ArrowDownCircle,
  LineChart,
  CandlestickChart,
  TrendingUp,
  Minus,
  RotateCw,
} from 'lucide-react';
import GlassCard from '../components/GlassCard';

// Helper to format timestamp to readable string
const formatTime = (ts) => {
  try {
    return new Date(ts).toLocaleString('en-US', { hour12: false });
  } catch {
    return ts;
  }
};

const MarketInfo = ({ data }) => (
  <div className="flex-grow grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
      <p className={`text-lg font-semibold ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {data.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h Change</p>
      <p className={`text-lg font-semibold ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {data.change > 0 ? '+' : ''}
        {data.change}%
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h High</p>
      <p className="text-lg font-semibold text-gray-800 dark:text-white">
        {data.high.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h Low</p>
      <p className="text-lg font-semibold text-gray-800 dark:text-white">
        {data.low.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">24h Volume</p>
      <p className="text-lg font-semibold text-gray-800 dark:text-white">
        {(data.volume / 1000).toFixed(1)}k
      </p>
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
  const availablePairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
  const [activePair, setActivePair] = useState(availablePairs[0]);
  const [activeInterval, setActiveInterval] = useState('1H');
  const [chartType, setChartType] = useState('line');
  const [activeTool, setActiveTool] = useState('none');
  const [buyMarker, setBuyMarker] = useState(null);
  const [sellMarker, setSellMarker] = useState(null);
  const [zoomDomain, setZoomDomain] = useState({}); // { left, right }
  const [selection, setSelection] = useState({ start: null, end: null }); // for drag-to-zoom
  const [marketData, setMarketData] = useState({});
  const [crosshair, setCrosshair] = useState(null);
  const [trendLines, setTrendLines] = useState([]); // { x1, y1, x2, y2 }
  const [tempTrendStart, setTempTrendStart] = useState(null);
  const [hLines, setHLines] = useState([]); // y values
  const [vLines, setVLines] = useState([]); // x values

  const chartWrapperRef = useRef(null);
  const panRef = useRef({ isPanning: false, startX: null, domainStart: {} });

  const currentMarketData = marketData[activePair] || {
    price: 0,
    change: 0,
    high: 0,
    low: 0,
    volume: 0,
    lineData: [],
    candleData: [],
  };

  const fetchMarket = useCallback(async () => {
    try {
      const symbol = activePair.replace('/', '');
      const interval = intervalMap[activeInterval];
      const [kRes, tRes] = await Promise.all([
        fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`
        ).then((r) => r.json()),
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then((r) =>
          r.json()
        ),
      ]);
      const lineData = kRes.map((k) => ({
        time: k[0],
        price: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
      const candleData = kRes.map((k) => ({
        time: k[0],
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
      setMarketData((prev) => ({ ...prev, [activePair]: info }));
    } catch (err) {
      console.error('fetchMarket error', err);
    }
  }, [activePair, activeInterval]);

  useEffect(() => {
    fetchMarket();
    const id = setInterval(fetchMarket, 60000);
    return () => clearInterval(id);
  }, [fetchMarket]);

  // Reset zoom when pair or interval changes
  useEffect(() => {
    setZoomDomain({});
  }, [activePair, activeInterval]);

  const chartData =
    chartType === 'line' ? currentMarketData.lineData : currentMarketData.candleData;

  const dataTimes = chartData.map((d) => d.time);
  const dataMin = Math.min(...dataTimes, 0);
  const dataMax = Math.max(...dataTimes, 1);

  const domainLeft = zoomDomain.left !== undefined ? zoomDomain.left : dataMin;
  const domainRight = zoomDomain.right !== undefined ? zoomDomain.right : dataMax;

  const visibleSlice = chartData.filter((d) => d.time >= domainLeft && d.time <= domainRight);
  const computeYRange = () => {
    if (!visibleSlice.length) return [0, 1];
    if (chartType === 'candle') {
      const lows = visibleSlice.map((d) => d.wick[0]);
      const highs = visibleSlice.map((d) => d.wick[1]);
      return [Math.min(...lows), Math.max(...highs)];
    }
    const prices = visibleSlice.map((d) => d.price);
    return [Math.min(...prices), Math.max(...prices)];
  };
  const yDomainActual = computeYRange();

  const clampDomain = useCallback(
    (left, right) => {
      let newLeft = left;
      let newRight = right;
      const minSpan = Math.max((dataMax - dataMin) / 100, 1);
      if (newLeft < dataMin) {
        const span = newRight - newLeft;
        newLeft = dataMin;
        newRight = dataMin + span;
      }
      if (newRight > dataMax) {
        const span = newRight - newLeft;
        newRight = dataMax;
        newLeft = dataMax - span;
      }
      if (newRight - newLeft < minSpan) {
        const mid = (newLeft + newRight) / 2;
        newLeft = mid - minSpan / 2;
        newRight = mid + minSpan / 2;
      }
      if (newLeft >= newRight) {
        return { left: dataMin, right: dataMax };
      }
      return { left: newLeft, right: newRight };
    },
    [dataMin, dataMax]
  );

  // Mouse interactions
  const handleMouseDown = useCallback((e) => {
    if (activeTool === 'zoom' && e && e.activeLabel !== undefined) {
      setSelection({ start: e.activeLabel, end: null });
    }
    if (activeTool === 'none' && e && e.activeLabel !== undefined) {
      panRef.current.isPanning = true;
      panRef.current.startX = e.activeLabel;
      panRef.current.domainStart = {
        left: domainLeft,
        right: domainRight,
      };
    }
  }, [activeTool, domainLeft, domainRight]);

  const handleMouseMove = useCallback((e) => {
    if (e && e.activePayload && e.activePayload.length) {
      const pt = e.activePayload[0].payload;
      let price;
      if (chartType === 'line') {
        price = pt.price;
      } else {
        price = pt.body[1];
      }
      setCrosshair({ x: e.activeLabel, y: price });
    } else {
      setCrosshair(null);
    }

    if (activeTool === 'zoom' && selection.start !== null && e && e.activeLabel !== undefined) {
      setSelection((s) => ({ ...s, end: e.activeLabel }));
    }

    if (activeTool === 'none' && panRef.current.isPanning && e && e.activeLabel !== undefined) {
      const delta = panRef.current.startX - e.activeLabel;
      const width = panRef.current.domainStart.right - panRef.current.domainStart.left;
      let newLeft = panRef.current.domainStart.left + delta;
      let newRight = panRef.current.domainStart.right + delta;
      const clamped = clampDomain(newLeft, newRight);
      setZoomDomain({ left: clamped.left, right: clamped.right });
    }
  }, [activeTool, selection.start, chartType, clampDomain]);

  const handleMouseUp = useCallback(
    (e) => {
      if (activeTool === 'zoom' && selection.start !== null && selection.end !== null) {
        let left = selection.start;
        let right = selection.end;
        if (left > right) [left, right] = [right, left];
        const clamped = clampDomain(left, right);
        setZoomDomain({ left: clamped.left, right: clamped.right });
        setSelection({ start: null, end: null });
      }
      if (panRef.current.isPanning) {
        panRef.current.isPanning = false;
      }
    },
    [activeTool, selection, clampDomain]
  );

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      if (!chartWrapperRef.current) return;
      const bounding = chartWrapperRef.current.getBoundingClientRect();
      const mouseX = e.clientX - bounding.left;
      const width = bounding.width;
      if (width <= 0) return;
      const span = domainRight - domainLeft;
      if (span <= 0) return;
      const percent = mouseX / width;
      const focal = domainLeft + span * percent;
      const scale = e.deltaY > 0 ? 1.1 : 0.9; // wheel down = zoom out
      const newSpan = span * scale;
      let newLeft = focal - (focal - domainLeft) * scale;
      let newRight = focal + (domainRight - focal) * scale;
      const clamped = clampDomain(newLeft, newRight);
      setZoomDomain({ left: clamped.left, right: clamped.right });
    },
    [domainLeft, domainRight, clampDomain]
  );

  const handleChartClick = useCallback(
    (e) => {
      if (!e || !e.activeLabel) return;
      const clickedTime = e.activeLabel;
      let clickedPrice;
      if (chartType === 'line') {
        clickedPrice = e.activePayload?.[0]?.payload?.price;
    } else {
      clickedPrice = e.activePayload?.[0]?.payload?.body?.[1];
    }
    if (clickedPrice === undefined) return;

    if (activeTool === 'buy') {
      setBuyMarker({ time: clickedTime, price: clickedPrice });
      return;
    }
    if (activeTool === 'sell') {
      setSellMarker({ time: clickedTime, price: clickedPrice });
      return;
    }
    if (activeTool === 'hLine') {
      setHLines((prev) => [...prev, clickedPrice]);
      return;
    }
    if (activeTool === 'vLine') {
      setVLines((prev) => [...prev, clickedTime]);
      return;
    }
    if (activeTool === 'trendLine') {
      if (!tempTrendStart) {
        setTempTrendStart({ x: clickedTime, y: clickedPrice });
      } else {
        setTrendLines((prev) => [
          ...prev,
          { x1: tempTrendStart.x, y1: tempTrendStart.y, x2: clickedTime, y2: clickedPrice },
        ]);
        setTempTrendStart(null);
      }
      return;
    },
    [activeTool, chartType, tempTrendStart]
  );

  const resetZoom = () => setZoomDomain({});

  const axisColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const priceColor = currentMarketData.change >= 0 ? '#22c55e' : '#ef4444';
  const volumeColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    if (chartType === 'candle') {
      const [open, close] = data.body;
      const [low, high] = data.wick;
      const volume = data.volume;
      return (
        <div
          className="p-2 rounded"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(20,20,40,0.9)' : 'rgba(255,255,255,0.9)',
            color: theme === 'dark' ? '#fff' : '#000',
            fontSize: 12,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <div className="mb-1">
            <strong>{formatTime(label)}</strong>
          </div>
          <div>Open: {open.toFixed(2)}</div>
          <div>High: {high.toFixed(2)}</div>
          <div>Low: {low.toFixed(2)}</div>
          <div>Close: {close.toFixed(2)}</div>
          <div>Volume: {volume.toLocaleString()}</div>
        </div>
      );
    } else {
      return (
        <div
          className="p-2 rounded"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(20,20,40,0.9)' : 'rgba(255,255,255,0.9)',
            color: theme === 'dark' ? '#fff' : '#000',
            fontSize: 12,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <div className="mb-1">
            <strong>{formatTime(label)}</strong>
          </div>
          <div>Price: {payload[0].value.toFixed(2)}</div>
        </div>
      );
    }
  };

  const mapTimeToXPercent = (time) => {
    const left = zoomDomain.left !== undefined ? zoomDomain.left : dataMin;
    const right = zoomDomain.right !== undefined ? zoomDomain.right : dataMax;
    if (right === left) return 0;
    return (time - left) / (right - left);
  };
  const mapPriceToYPercent = (price) => {
    const [yMin, yMax] = yDomainActual;
    if (yMax === yMin) return 1;
    return 1 - (price - yMin) / (yMax - yMin);
  };

  const setRangeToLast = (durationMs) => {
    const now = dataMax;
    const targetLeft = now - durationMs;
    const clamped = clampDomain(targetLeft, now);
    setZoomDomain({ left: clamped.left, right: clamped.right });
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <GlassCard className="mb-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <select
                value={activePair}
                onChange={(e) => setActivePair(e.target.value)}
                className="px-4 py-2 text-sm font-semibold rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none"
              >
                {availablePairs.map((pair) => (
                  <option key={pair} value={pair}>
                    {pair}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setRangeToLast(60 * 60 * 1000 * 24)}
                className="px-2 py-1 text-xs rounded-md bg-black/10 dark:bg-white/20"
              >
                1D
              </button>
              <button
                onClick={() => setRangeToLast(60 * 60 * 1000 * 24 * 7)}
                className="px-2 py-1 text-xs rounded-md bg-black/10 dark:bg-white/20"
              >
                1W
              </button>
              <button
                onClick={() => setRangeToLast(60 * 60 * 1000 * 24 * 30)}
                className="px-2 py-1 text-xs rounded-md bg-black/10 dark:bg-white/20"
              >
                1M
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 text-xs rounded-md bg-red-100 text-red-600"
              >
                Full
              </button>
            </div>
          </div>
          <MarketInfo data={currentMarketData} />
        </div>
      </GlassCard>

      <div className="flex gap-6">
        <GlassCard className="p-2 self-start">
          <div className="flex flex-col gap-1">
            {[
              { tool: 'zoom', icon: ZoomIn },
              { tool: 'buy', icon: ArrowUpCircle },
              { tool: 'sell', icon: ArrowDownCircle },
              { tool: 'trendLine', icon: TrendingUp },
              { tool: 'hLine', icon: Minus },
              { tool: 'vLine', icon: RotateCw },
            ].map(({ tool, icon: Icon }) => (
              <button
                key={tool}
                onClick={() => {
                  if (activeTool === tool) {
                    setActiveTool('none');
                  } else {
                    setActiveTool(tool);
                    if (tool !== 'trendLine') setTempTrendStart(null);
                  }
                }}
                className={`p-2 rounded-md flex items-center justify-center ${
                  activeTool === tool
                    ? 'bg-cyan-500/30 text-cyan-400'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={tool}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
          {activeTool === 'trendLine' && tempTrendStart && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Click second point to finish trend line
            </div>
          )}
        </GlassCard>

        <GlassCard className="flex-grow relative">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
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
            {(zoomDomain.left !== undefined || zoomDomain.right !== undefined) && (
              <button
                onClick={resetZoom}
                className="px-3 py-1 text-xs rounded-md bg-cyan-500/30 text-cyan-400"
              >
                Reset Zoom
              </button>
            )}
            <div className="flex items-center space-x-1 bg-black/5 dark:bg-white/10 p-1 rounded-md">
              <button
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded ${chartType === 'line' ? 'bg-white/20' : ''}`}
              >
                <LineChart size={18} />
              </button>
              <button
                onClick={() => setChartType('candle')}
                className={`p-1.5 rounded ${chartType === 'candle' ? 'bg-white/20' : ''}`}
              >
                <CandlestickChart size={18} />
              </button>
            </div>
          </div>

          <div
            style={{ width: '100%', height: 420, position: 'relative', touchAction: 'none' }}
            ref={chartWrapperRef}
            onWheelCapture={(e) => {
              e.preventDefault();
              handleWheel(e);
            }}
            onMouseLeave={(e) => {
              handleMouseUp(e);
              setCrosshair(null);
            }}
          >
            <ResponsiveContainer>
              <ComposedChart
                data={chartData}
                syncId="anyId"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleChartClick}
                margin={{ top: 10, right: 50, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`priceGradient${priceColor.replace('#', '')}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={priceColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[zoomDomain.left || 'dataMin', zoomDomain.right || 'dataMax']}
                  allowDataOverflow
                  tickFormatter={(t) => {
                    const d = new Date(t);
                    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                  }}
                  minTickGap={20}
                />
                <YAxis
                  orientation="right"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  tickFormatter={(value) =>
                    value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  }
                  tickLine={false}
                  axisLine={false}
                  domain={chartType === 'candle' ? yDomainActual : ['auto', 'auto']}
                  allowDataOverflow
                  width={70}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: axisColor, strokeDasharray: '3 3' }}
                  wrapperStyle={{ zIndex: 10 }}
                />
                {chartType === 'line' ? (
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={priceColor}
                    strokeWidth={2}
                    fill={`url(#priceGradient${priceColor.replace('#', '')})`}
                    name="Price"
                    isAnimationActive={false}
                    dot={false}
                  />
                ) : (
                  <>
                    <Bar dataKey="wick" shape={<WickShape />} isAnimationActive={false} />
                    <Bar dataKey="body" shape={<CandleStickShape />} isAnimationActive={false} />
                  </>
                )}

                {/* Crosshair */}
                {crosshair && (
                  <>
                    <ReferenceLine
                      x={crosshair.x}
                      stroke={axisColor}
                      strokeDasharray="3 3"
                      isFront
                    />
                    <ReferenceLine
                      y={crosshair.y}
                      stroke={axisColor}
                      strokeDasharray="3 3"
                      isFront
                    />
                  </>
                )}

                {/* Horizontal Lines */}
                {hLines.map((yVal, i) => (
                  <ReferenceLine
                    key={`h-${i}`}
                    y={yVal}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      position: 'right',
                      value: `H: ${yVal.toFixed(2)}`,
                      style: { fontSize: 10, fill: '#f59e0b' },
                    }}
                  />
                ))}

                {/* Vertical Lines */}
                {vLines.map((xVal, i) => (
                  <ReferenceLine
                    key={`v-${i}`}
                    x={xVal}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      position: 'top',
                      value: formatTime(xVal),
                      style: { fontSize: 10, fill: '#10b981' },
                    }}
                  />
                ))}

                {/* Buy/Sell Markers */}
                {buyMarker && (
                  <ReferenceDot
                    x={buyMarker.time}
                    y={buyMarker.price}
                    r={6}
                    fill="#22c55e"
                    stroke="none"
                    isFront
                    label={{
                      position: 'top',
                      value: 'Buy',
                      style: { fill: '#22c55e', fontWeight: 'bold', fontSize: 12 },
                    }}
                  />
                )}
                {sellMarker && (
                  <ReferenceDot
                    x={sellMarker.time}
                    y={sellMarker.price}
                    r={6}
                    fill="#ef4444"
                    stroke="none"
                    isFront
                    label={{
                      position: 'bottom',
                      value: 'Sell',
                      style: { fill: '#ef4444', fontWeight: 'bold', fontSize: 12 },
                    }}
                  />
                )}

                {/* Drag-to-zoom selection */}
                {activeTool === 'zoom' && selection.start !== null && selection.end !== null && (
                  <ReferenceArea
                    x1={Math.min(selection.start, selection.end)}
                    x2={Math.max(selection.start, selection.end)}
                    strokeOpacity={0.3}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Overlay trend lines */}
            <div
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                {trendLines.map((ln, idx) => {
                  const x1p = mapTimeToXPercent(ln.x1);
                  const x2p = mapTimeToXPercent(ln.x2);
                  const y1p = mapPriceToYPercent(ln.y1);
                  const y2p = mapPriceToYPercent(ln.y2);
                  return (
                    <line
                      key={`trend-${idx}`}
                      x1={`${x1p * 100}%`}
                      x2={`${x2p * 100}%`}
                      y1={`${y1p * 100}%`}
                      y2={`${y2p * 100}%`}
                      stroke="#6366f1"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  );
                })}
                {tempTrendStart && crosshair && activeTool === 'trendLine' && (
                  <line
                    x1={`${mapTimeToXPercent(tempTrendStart.x) * 100}%`}
                    y1={`${mapPriceToYPercent(tempTrendStart.y) * 100}%`}
                    x2={`${mapTimeToXPercent(crosshair.x) * 100}%`}
                    y2={`${mapPriceToYPercent(crosshair.y) * 100}%`}
                    stroke="#a78bfa"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Volume + Brush */}
          <div style={{ width: '100%', height: 120, marginTop: 4 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} syncId="anyId">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  hide
                  domain={[zoomDomain.left || 'dataMin', zoomDomain.right || 'dataMax']}
                  allowDataOverflow
                />
                <YAxis
                  orientation="right"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? 'rgba(20,20,40,0.8)' : 'rgba(255,255,255,0.8)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                  }}
                />
                <Bar dataKey="volume" fill={volumeColor} name="Volume" />
                <Brush
                  dataKey="time"
                  height={20}
                  stroke={axisColor}
                  travellerWidth={10}
                  onChange={(b) => {
                    if (b && b.startIndex !== undefined && b.endIndex !== undefined) {
                      const slice = chartData.slice(b.startIndex, b.endIndex + 1);
                      if (slice.length) {
                        const left = slice[0].time;
                        const right = slice[slice.length - 1].time;
                        const clamped = clampDomain(left, right);
                        setZoomDomain({ left: clamped.left, right: clamped.right });
                      }
                    }
                  }}
                  traveller={true}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
