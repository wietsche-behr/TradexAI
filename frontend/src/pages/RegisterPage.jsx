import { useState } from 'react';

export default function RegisterPage({ onRegistered, goToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Registration failed');
      }
      setSuccess(true);
      setUsername('');
      setPassword('');
      if (onRegistered) onRegistered();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded shadow-md w-80">
        <h2 className="text-2xl mb-4 text-center text-gray-800 dark:text-gray-100">Register</h2>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        {success && <p className="text-green-500 mb-2">Registration successful!</p>}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md mb-2"
        >
          Register
        </button>
        <button
          type="button"
          onClick={goToLogin}
          className="w-full py-2 px-4 bg-black/10 dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-md"
        >
          Back to Login
        </button>
      </form>
    </div>
  );
}
