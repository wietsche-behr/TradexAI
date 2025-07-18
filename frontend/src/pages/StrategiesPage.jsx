import { useState } from 'react';
import { TrendingUp, PlayCircle, StopCircle } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import StatusBadge from '../components/StatusBadge';

const initialStrategies = [
  { id: 1, name: 'Momentum Scalper v2', description: 'A high-frequency strategy that capitalizes on small price movements in volatile markets.', successRate: 82.4, status: 'Active' },
  { id: 2, name: 'Mean Reversion Pro', description: 'Identifies overextended price moves and trades on the expectation of a return to the mean.', successRate: 76.1, status: 'Inactive' },
  { id: 3, name: 'Arbitrage Finder', description: 'Scans multiple exchanges to find and exploit price discrepancies for the same asset.', successRate: 98.2, status: 'Active' },
  { id: 4, name: 'Trend Follower AI', description: 'Uses machine learning to identify and follow long-term market trends for sustained gains.', successRate: 68.9, status: 'Inactive' },
];

const StrategyCard = ({ strategy, onToggle }) => {
  const isActive = strategy.status === 'Active';
  const successRateColor = strategy.successRate > 80 ? 'text-green-400' : strategy.successRate > 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <GlassCard className="flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{strategy.name}</h3>
          <StatusBadge status={strategy.status} />
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 h-16">{strategy.description}</p>
      </div>
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-200">
            <TrendingUp size={20} />
            <span>Last Week's Success</span>
          </div>
          <span className={`text-lg font-bold ${successRateColor}`}>{strategy.successRate}%</span>
        </div>
        <button onClick={() => onToggle(strategy.id)} className={`w-full py-3 rounded-lg text-white font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-2 ${isActive ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-green-500 hover:bg-green-600 shadow-green-500/30'} shadow-lg`}>
          {isActive ? <StopCircle size={20} /> : <PlayCircle size={20} />}
          <span>{isActive ? 'STOP STRATEGY' : 'START STRATEGY'}</span>
        </button>
      </div>
    </GlassCard>
  );
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState(initialStrategies);

  const handleToggleStrategy = (strategyId) => {
    setStrategies(strategies.map((s) => (s.id === strategyId ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' } : s)));
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Strategy Management</h2>
        <p className="text-gray-600 dark:text-gray-400">Activate or deactivate trading strategies.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {strategies.map((strategy) => (
          <StrategyCard key={strategy.id} strategy={strategy} onToggle={handleToggleStrategy} />
        ))}
      </div>
    </main>
  );
}
