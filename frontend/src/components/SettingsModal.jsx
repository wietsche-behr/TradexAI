import { useState, useEffect } from 'react';

export default function SettingsModal({ visible, onClose, token }) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const show = visible ? '' : 'hidden';

  useEffect(() => {
    if (visible) {
      fetch('http://localhost:8000/settings', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          setApiKey(data.binance_api_key);
          setApiSecret(data.binance_api_secret);
        })
        .catch(() => {
          setApiKey('');
          setApiSecret('');
        });
    }
  }, [visible, token]);

  const handleSave = () => {
    fetch('http://localhost:8000/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        binance_api_key: apiKey,
        binance_api_secret: apiSecret,
      }),
    })
      .then(() => onClose())
      .catch(() => onClose());
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black/50 ${show}`}>
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow w-80">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Settings</h2>
        <div className="mb-3">
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Binance API Key</label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Binance API Secret</label>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-black/10 dark:bg-white/10 rounded">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 text-white rounded">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
