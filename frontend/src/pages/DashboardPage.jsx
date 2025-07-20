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
import { Activity, DollarSign, Shield, Clock, Zap } from 'lucide-react';
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
    <GlassCard className="col-span-12 lg:col-span-8 h-[450px] flex flex-col">
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
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/bot', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [token]);

  const toggleBot = () => {
    if (!config) return;
    fetch('http://localhost:8000/bot', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...config, is_active: !config.is_active }),
    })
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {});
  };

  const isBotActive = config ? config.is_active : false;
  return (
    <GlassCard className="col-span-12 lg:col-span-4 h-full flex flex-col justify-between">
      <div>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Bot Control</h3>
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-600 dark:text-gray-300">Status</span>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${isBotActive ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
            <div className={`w-2 h-2 rounded-full ${isBotActive ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span>{isBotActive ? 'Active' : 'Stopped'}</span>
          </div>
        </div>
        {config ? (
          <div className="space-y-3 text-gray-700 dark:text-gray-200">
            <p><strong>Strategy:</strong> {config.strategy}</p>
            <p><strong>Risk Level:</strong> {config.risk_level}</p>
            <p><strong>Market:</strong> {config.market}</p>
          </div>
        ) : (
          <p className="text-gray-500">No configuration</p>
        )}
      </div>
      <button onClick={toggleBot} className={`w-full py-3 mt-6 rounded-lg text-white font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-2 ${isBotActive ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-green-500 hover:bg-green-600 shadow-green-500/30'} shadow-lg`}>
        <Zap size={20}/>
        <span>{isBotActive ? 'STOP BOT' : 'START BOT'}</span>
      </button>
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
            <th className="p-3">Type</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Profit/Loss</th>
          </tr>
        </thead>
        <tbody>
          {tradeHistory.map((trade) => (
            <tr key={trade.id} className="border-b border-gray-400/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <td className="p-3 font-mono text-xs">{trade.id}</td>
              <td className="p-3 font-semibold text-gray-800 dark:text-white">{trade.pair}</td>
              <td className={`p-3 font-bold ${trade.type === 'BUY' ? 'text-cyan-500 dark:text-cyan-400' : 'text-fuchsia-500 dark:text-fuchsia-400'}`}>{trade.type}</td>
              <td className="p-3"><span className={`px-2 py-1 text-xs rounded-full ${trade.status === 'Open' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-500/20 text-gray-300'}`}>{trade.status}</span></td>
              <td className={`p-3 text-right font-semibold ${trade.profit >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-400'}`}>{trade.profit >= 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`}</td>
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
  const [stats, setStats] = useState({
    total_profit: 0,
    win_rate: 0,
    active_trades: 0,
    avg_trade_duration: 0,
  });


  useEffect(() => {
    fetch('http://localhost:8000/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setChartData(data.chart_data || []);
        setTradeHistory(data.trade_history || []);
        setStats(data.stats || {});
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
