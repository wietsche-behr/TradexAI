export default function GlassCard({ children, className = '' }) {
  const baseClasses =
    'backdrop-blur-lg rounded-2xl shadow-lg p-4 sm:p-6 transition-all duration-300 bg-gray-500/10 dark:bg-white/20 border border-gray-400/20 dark:border-white/20';
  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
}
