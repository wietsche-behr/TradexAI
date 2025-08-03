import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Activity, DollarSign, Shield, Clock } from 'lucide-react';
import GlassCard from '../components/GlassCard';


const StatCard = ({ icon, title, value, change, changeType }) => {
  const changeColor = changeType === 'increase' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';
  return (
    <GlassCard className="flex-1">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-black/5 dark:bg-white/10 rounded-full border border-black/10 dark:border-white/20">{icon}</div>
        <div>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{title}</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-white">{value}</p>
          {change && <p className={`text-sm ${changeColor}`}>{change}</p>}
        </div>
      </div>
    </GlassCard>
  );
};

const MainChart = ({ theme, data }) => {
  const axisColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  return (
    <GlassCard className="col-span-12 lg:col-span-7 h-[350px] flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Performance Overview</h3>
          <p className="text-gray-600 dark:text-gray-400">Last 24 hours</p>
        </div>
        <div className="flex space-x-2">
          <button className="px-3 py-1 text-sm bg-black/10 dark:bg-white/20 rounded-md hover:bg-cyan-500/50 transition">1D</button>
          <button className="px-3 py-1 text-sm bg-black/5 dark:bg-white/10 rounded-md hover:bg-cyan-500/50 transition">7D</button>
          <button className="px-3 py-1 text-sm bg-black/5 dark:bg-white/10 rounded-md hover:bg-cyan-500/50 transition">1M</button>
        </div>
      </div>
      <div className="flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="name" stroke={axisColor} tick={{ fill: axisColor }} />
            <YAxis stroke={axisColor} tickFormatter={(value) => `$${value / 1000}k`} tick={{ fill: axisColor }} />
            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? 'rgba(20, 20, 40, 0.8)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)', color: theme === 'dark' ? '#ffffff' : '#000000', borderRadius: '10px' }} labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000' }} />
            <Legend iconType="circle" />
            <Area type="monotone" dataKey="profit" stroke="#06b6d4" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} name="Profit" />
            <Area type="monotone" dataKey="loss" stroke="#f43f5e" fillOpacity={1} fill="url(#colorLoss)" strokeWidth={2} name="Loss" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};

const BotControl = ({ token }) => {
  const [strategies, setStrategies] = useState([]);
  const [tradeLogs, setTradeLogs] = useState([]);

  useEffect(() => {
    const fetchData = () => {
      fetch('http://localhost:8000/strategies', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) =>
          setStrategies((data.strategies || []).filter((s) => s.running))
        )
        .catch(() => setStrategies([]));

      fetch('http://localhost:8000/trade_logs', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setTradeLogs(data.logs || []))
        .catch(() => setTradeLogs([]));
    };
    fetchData();
    const id = setInterval(fetchData, 2000);
    return () => clearInterval(id);
  }, [token]);

  const stopStrategy = (id) => {
    fetch(`http://localhost:8000/strategy/${id}/stop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStrategies((prev) => prev.filter((s) => s.id !== id));
      })
      .catch(() => {});
  };

  const parseTradeLog = (log) => {
    const m = log.match(/(BUY|SELL)\s+(\w+)\s+qty\s+([\d.]+)/i);
    if (!m) return { type: '', pair: '', qty: '', raw: log };
    return { type: m[1].toUpperCase(), pair: m[2].toUpperCase(), qty: m[3] };
  };

  return (
    <GlassCard className="col-span-12 lg:col-span-5 h-[350px] flex flex-col">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Bot Control</h3>
      <div className="flex-grow overflow-y-auto">
        <div className="mb-4">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Running Strategies</h4>
          {strategies.length ? (
            <ul className="space-y-2">
              {strategies.map((s) => (
                <li key={s.id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 dark:text-gray-200">{s.name}</span>
                  <button
                    onClick={() => stopStrategy(s.id)}
                    className="px-2 py-1 rounded bg-red-500/80 text-white"
                  >
                    Stop
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No strategies running</p>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Trade Logs</h4>
          <div className="max-h-40 overflow-y-auto">
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-100">
              <thead className="border-b border-gray-400/20 dark:border-white/20">
                <tr>
                  <th className="p-1">Type</th>
                  <th className="p-1">Pair</th>
                  <th className="p-1">Qty</th>
                </tr>
              </thead>
              <tbody>
                {tradeLogs.map((log, i) => {
                  const t = parseTradeLog(log);
                  return (
                    <tr key={i} className="border-b border-gray-400/10 dark:border-white/10">
                      <td
                        className={`p-1 font-bold ${t.type === 'BUY' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                      >
                        {t.type || log}
                      </td>
                      <td className="p-1">{t.pair}</td>
                      <td className="p-1">{t.qty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

const TradeHistoryTable = ({ tradeHistory }) => (
  <GlassCard className="col-span-12">
    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Trade History</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-gray-600 dark:text-gray-300">
        <thead className="border-b border-gray-400/20 dark:border-white/20">
          <tr>
            <th className="p-3">ID</th>
            <th className="p-3">Pair</th>
            <th className="p-3">Strategy</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Profit %</th>
            <th className="p-3 text-right">Profit $</th>
          </tr>
        </thead>
        <tbody>
          {tradeHistory.map((trade) => (
            <tr key={trade.id} className="border-b border-gray-400/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <td className="p-3 font-mono text-xs">{trade.id}</td>
              <td className="p-3 font-semibold text-gray-800 dark:text-white">{trade.pair}</td>
              <td className="p-3">{trade.strategy}</td>
              <td className="p-3"><span className={`px-2 py-1 text-xs rounded-full ${trade.status === 'Open' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-500/20 text-gray-300'}`}>{trade.status}</span></td>
              <td className="p-3 text-right font-semibold">{trade.profit_percentage.toFixed(2)}%</td>
              <td className={`p-3 text-right font-semibold ${trade.profit >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-400'}`}>${trade.profit.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </GlassCard>
);

export default function DashboardPage({ theme, token }) {
  const [chartData, setChartData] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const defaultStats = {
    total_profit: 0,
    win_rate: 0,
    active_trades: 0,
    avg_trade_duration: 0,
  };
  const [stats, setStats] = useState(defaultStats);


  useEffect(() => {
    fetch('http://localhost:8000/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setChartData(data.chart_data || []);
        setTradeHistory(data.trade_history || []);
        const s = data.stats || {};
        setStats({
          total_profit: Number(s.total_profit) || 0,
          win_rate: Number(s.win_rate) || 0,
          active_trades: Number(s.active_trades) || 0,
          avg_trade_duration: Number(s.avg_trade_duration) || 0,
        });
      })
      .catch(() => {});
  }, [token]);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          icon={<DollarSign className="text-cyan-500 dark:text-cyan-400" />}
          title="Total Profit"
          value={`$${stats.total_profit.toFixed(2)}`}
        />
        <StatCard
          icon={<Activity className="text-cyan-500 dark:text-cyan-400" />}
          title="Win Rate"
          value={`${stats.win_rate.toFixed(1)}%`}
        />
        <StatCard
          icon={<Shield className="text-cyan-500 dark:text-cyan-400" />}
          title="Active Trades"
          value={stats.active_trades}
        />
        <StatCard
          icon={<Clock className="text-cyan-500 dark:text-cyan-400" />}
          title="Avg. Trade Duration"
          value={`${stats.avg_trade_duration}m`}
        />
      </div>
      <div className="grid grid-cols-12 gap-6">
        <MainChart theme={theme} data={chartData} />
        <BotControl token={token} />
        <TradeHistoryTable tradeHistory={tradeHistory} />
      </div>
    </main>
  );
}
