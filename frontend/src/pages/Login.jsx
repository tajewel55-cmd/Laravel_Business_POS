import { useState } from 'react';
import api from '../api';

export default function Login({ setUser }) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    // Input Validation
    if (!userName.trim() || !password) {
      setError('Username and Password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/login', {
        user_name: userName.trim(),
        password: password,
      });

      // API Response Handling
      if (response.data && (response.data.status === 'success' || response.data.token)) {
        const token = response.data.token;
        const userData = response.data.user;

        // Save token & user data securely to local storage
        if (token) {
          localStorage.setItem('auth_token', token);
        }
        if (userData) {
          localStorage.setItem('user', typeof userData === 'object' ? JSON.stringify(userData) : userData);
          setUser(userData);
        }
      } else {
        setError(response.data?.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      // Handles network error, server crash, or 401/422 responses safely
      const serverMessage = err.response?.data?.message || err.response?.data?.error;
      if (serverMessage) {
        setError(serverMessage);
      } else if (err.request) {
        setError('Network error. Unable to connect to the server.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-white px-4">
      <div className="bg-white shadow-md rounded-lg max-w-md w-full overflow-hidden border border-gray-200">

        {/* Header with #417690 */}
        <div className="bg-[#417690] text-white text-center py-4 text-lg font-medium tracking-wide">
          BusinessPOS Login System
        </div>

        {/* Form Body - ব্রাউজার হিস্ট্রি ও সাজেশনের জন্য autoComplete এবং name যুক্ত করা হয়েছে */}
        <form onSubmit={handleLogin} className="p-6 sm:p-8" autoComplete="on">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm border border-red-200 text-center">
              {error}
            </div>
          )}

          <div className="mb-4 text-left">
            <label className="block text-gray-700 font-medium mb-1 text-sm">
              Username:
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter username"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#417690] focus:ring-1 focus:ring-[#417690] bg-white text-gray-900 placeholder-gray-400"
            />
          </div>

          <div className="mb-6 text-left">
            <label className="block text-gray-700 font-medium mb-1 text-sm">
              Password:
            </label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#417690] focus:ring-1 focus:ring-[#417690] bg-white text-gray-900 placeholder-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#417690] hover:bg-[#355f75] text-white font-medium py-2 px-4 rounded transition duration-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}