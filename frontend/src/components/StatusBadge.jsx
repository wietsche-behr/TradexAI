export default function StatusBadge({ status }) {
  const statusStyles = {
    Active: 'bg-green-500/20 text-green-300',
    Pending: 'bg-yellow-500/20 text-yellow-300',
    Disabled: 'bg-red-500/20 text-red-300',
    Inactive: 'bg-gray-500/20 text-gray-300',
  };
  return <span className={`px-3 py-1 text-xs rounded-full ${statusStyles[status]}`}>{status}</span>;
}
