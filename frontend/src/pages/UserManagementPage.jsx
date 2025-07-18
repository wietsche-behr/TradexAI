import { useState } from 'react';
import { Search, CheckCircle, XCircle, UserX } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import StatusBadge from '../components/StatusBadge';

const initialUsers = [
  { id: 1, name: 'John Doe', email: 'john.doe@example.com', registrationDate: '2023-10-26', status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', registrationDate: '2023-10-25', status: 'Pending' },
  { id: 3, name: 'Sam Wilson', email: 'sam.wilson@example.com', registrationDate: '2023-10-24', status: 'Disabled' },
  { id: 4, name: 'Alice Johnson', email: 'alice.j@example.com', registrationDate: '2023-10-22', status: 'Pending' },
  { id: 5, name: 'Bob Brown', email: 'bob.brown@example.com', registrationDate: '2023-10-21', status: 'Active' },
  { id: 6, name: 'Chris Green', email: 'chris.g@example.com', registrationDate: '2023-10-27', status: 'Pending' },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');

  const handleStatusChange = (userId, newStatus) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
  };

  const applyFilter = (user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase());

  const pendingUsers = users.filter((u) => u.status === 'Pending').filter(applyFilter);
  const managedUsers = users.filter((u) => u.status !== 'Pending').filter(applyFilter);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">User Administration</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search all users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-black/10 dark:bg-white/10 border border-gray-400/20 dark:border-white/20 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-gray-800 dark:text-white"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={20} />
        </div>
      </div>

      <GlassCard className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Pending Approval ({pendingUsers.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-600 dark:text-gray-300">
            <thead className="border-b border-gray-400/20 dark:border-white/20">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Email</th>
                <th className="p-4">Registration Date</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.length > 0 ? (
                pendingUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-400/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-gray-800 dark:text-white">{user.name}</td>
                    <td className="p-4">{user.email}</td>
                    <td className="p-4">{user.registrationDate}</td>
                    <td className="p-4">
                      <div className="flex justify-center items-center space-x-2">
                        <button onClick={() => handleStatusChange(user.id, 'Active')} className="p-2 rounded-full text-green-400 hover:bg-green-500/20 transition" title="Approve">
                          <CheckCircle size={20} />
                        </button>
                        <button onClick={() => handleStatusChange(user.id, 'Disabled')} className="p-2 rounded-full text-red-400 hover:bg-red-500/20 transition" title="Reject">
                          <XCircle size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center p-6 text-gray-500">No users pending approval.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">User Management</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-600 dark:text-gray-300">
            <thead className="border-b border-gray-400/20 dark:border-white/20">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Email</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {managedUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-400/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4 font-semibold text-gray-800 dark:text-white">{user.name}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4"><StatusBadge status={user.status} /></td>
                  <td className="p-4">
                    <div className="flex justify-center items-center space-x-2">
                      {user.status === 'Active' && (
                        <button onClick={() => handleStatusChange(user.id, 'Disabled')} className="p-2 rounded-full text-yellow-400 hover:bg-yellow-500/20 transition" title="Disable User">
                          <UserX size={20} />
                        </button>
                      )}
                      {user.status === 'Disabled' && (
                        <button onClick={() => handleStatusChange(user.id, 'Active')} className="p-2 rounded-full text-green-400 hover:bg-green-500/20 transition" title="Enable User">
                          <CheckCircle size={20} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </main>
  );
}
