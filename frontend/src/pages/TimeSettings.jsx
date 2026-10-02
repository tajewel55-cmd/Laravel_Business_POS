import { useState, useEffect } from 'react';
import axios from 'axios';

// Small inline SVG icons for text buttons
const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconRefresh = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.23-5.23" />
  </svg>
);

const BRAND = '#417690';
const BRAND_DARK = '#2f5163';

export default function TimeSettings() {
  const [formData, setFormData] = useState({
    hours: '',
    is_active: 'Active / Standard'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-hide success or error messages after 2 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // টোকেন না থাকলে আগে "Bearer undefined"/"Bearer null" পাঠানো হতো — এখন সেক্ষেত্রে খালি স্ট্রিং পাঠাবে
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const fetchTimeSettings = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/time-settings', getAuthHeaders());
      if (response.data && response.data.data) {
        setFormData({
          hours: response.data.data.hours ?? '',
          is_active: response.data.data.is_active ?? 'Active / Standard'
        });
      }
    } catch (err) {
      console.error('Error fetching time settings', err);
      setError('Failed to load time settings.');
    }
  };

  useEffect(() => {
    fetchTimeSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/time-settings', formData, getAuthHeaders());
      setSuccess(response.data.message || 'Time settings saved successfully!');
      if (response.data && response.data.data) {
        setFormData({
          hours: response.data.data.hours ?? '',
          is_active: response.data.data.is_active ?? 'Active / Standard'
        });
      }
    } catch (err) {
      console.error('Error saving time settings', err);
      setError(err.response?.data?.message || 'Failed to update time settings.');
    } finally {
      setLoading(false);
    }
  };

  // আগে "Show" ও "Clear" — দুইটা আলাদা বাটন ছিল যারা কার্যত প্রায় একই কাজ করত
  // (দুটোই শেষ পর্যন্ত সার্ভার থেকে আবার ডেটা লোড করত)। এখন একটা বাটনেই
  // মিলিয়ে দেওয়া হয়েছে: "Reset / Reload"
  const handleResetReload = () => {
    fetchTimeSettings();
    setError('');
    setSuccess('Form reloaded with current data.');
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#417690]';
  const labelCls = 'block text-sm font-semibold text-gray-800';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 bg-white shadow-sm rounded-lg mt-6 border border-gray-200">
      {/* Top header bar */}
      <div
        className="rounded-t-md shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 mb-6"
        style={{ background: BRAND }}
      >
        <h1 className="text-base sm:text-lg font-bold text-white tracking-wide text-center sm:text-left">
          ⏰ Time Settings Management
        </h1>

        <div className="flex-1 px-2 text-center">
          {error && <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{error}</span>}
          {success && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{success}</span>}
        </div>
      </div>

      {/* Form Section with Two Cards */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left Card: Time Settings Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Time Settings Information
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Hours / Time Value</label>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="hours"
                    value={formData.hours}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 13 hours"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Time Settings Details Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Time Settings Details Information
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Status</label>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="is_active"
                    value={formData.is_active}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Action bar — এখন শুধু ২টা বাটন: Save Changes ও Reset / Reload */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-3 px-4 mt-6 rounded shadow-md" style={{ background: BRAND }}>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
            style={{ background: BRAND_DARK }}
          >
            <IconPlus size={14} />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleResetReload}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
            style={{ background: BRAND_DARK }}
          >
            <IconRefresh size={14} />
            Reset / Reload
          </button>
        </div>
      </form>
    </div>
  );
}