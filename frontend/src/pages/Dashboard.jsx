import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_products: 0,
    today_sales: '৳ 0.00',
    running_month_sales: '৳ 0.00',
    inventory_stock_amount: '৳ 0.00',
  });
  const [lastThreeMonthsSales, setLastThreeMonthsSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Profile Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/dashboard`, getAuthHeaders());
      if (response.data) {
        setStats(response.data.stats || stats);
        setLastThreeMonthsSales(response.data.lastThreeMonthsSales || []);
        if (response.data.user_name) {
          setUserName(response.data.user_name);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('ড্যাশবোর্ড ডাটা লোড করতে ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = { user_name: userName };
      if (password) payload.password = password;

      const response = await axios.put(`${API_BASE_URL}/dashboard/profile/update`, payload, getAuthHeaders());
      if (response.data) {
        setUpdateMessage('Profile updated successfully!');
        setPassword('');
        setTimeout(() => {
          setIsModalOpen(false);
          setUpdateMessage('');
        }, 1500);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setUpdateMessage('প্রোফাইল আপডেট করতে সমস্যা হয়েছে।');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500 text-sm">ড্যাশবোর্ড লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800">
      
      {error && (
        <div className="p-4 text-sm text-rose-800 border border-rose-200 rounded-xl bg-rose-50 font-semibold">
          ❌ {error}
        </div>
      )}

      {/* ওয়েলকাম ব্যানার */}
      <div className="bg-linear-to-r from-[#2c4e60] to-[#417690] text-white p-6 rounded-2xl shadow-md">
        <h1 className="text-xl lg:text-2xl font-bold">Welcome, {userName || 'Admin'}!</h1>
        <p className="text-xs lg:text-sm text-sky-100 mt-1">Here is a quick glance at your business performance today.</p>
      </div>

      {/* স্ট্যাটস কার্ড সমূহ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        
        <div className="bg-linear-to-br from-white to-sky-50/20 p-5 rounded-xl border-2 border-[#417690] shadow-sm flex items-center space-x-4 transition transform hover:-translate-y-1 duration-200">
          <div className="p-3 bg-[#417690] text-white rounded-lg text-2xl shadow-xs">📦</div>
          <div>
            <p className="text-xs text-[#417690] font-bold uppercase tracking-wider">Total Products</p>
            <h3 className="text-xl font-black text-[#417690] mt-0.5">{stats.total_products}</h3>
          </div>
        </div>

        <div className="bg-linear-to-br from-white to-sky-50/20 p-5 rounded-xl border-2 border-[#417690] shadow-sm flex items-center space-x-4 transition transform hover:-translate-y-1 duration-200">
          <div className="p-3 bg-[#417690] text-white rounded-lg text-2xl shadow-xs">💰</div>
          <div>
            <p className="text-xs text-[#417690] font-bold uppercase tracking-wider">Today's Sales</p>
            <h3 className="text-xl font-black text-[#417690] mt-0.5">{stats.today_sales}</h3>
          </div>
        </div>

        <div className="bg-linear-to-br from-white to-sky-50/20 p-5 rounded-xl border-2 border-[#417690] shadow-sm flex items-center space-x-4 transition transform hover:-translate-y-1 duration-200">
          <div className="p-3 bg-[#417690] text-white rounded-lg text-2xl shadow-xs">📊</div>
          <div>
            <p className="text-xs text-[#417690] font-bold uppercase tracking-wider">THIS Month Sales</p>
            <h3 className="text-xl font-black text-[#417690] mt-0.5">{stats.running_month_sales}</h3>
          </div>
        </div>

        <div className="bg-linear-to-br from-white to-sky-50/20 p-5 rounded-xl border-2 border-[#417690] shadow-sm flex items-center space-x-4 transition transform hover:-translate-y-1 duration-200">
          <div className="p-3 bg-[#417690] text-white rounded-lg text-2xl shadow-xs">🏢</div>
          <div>
            <p className="text-xs text-[#417690] font-bold uppercase tracking-wider">Inventory Amount</p>
            <h3 className="text-xl font-black text-[#417690] mt-0.5">{stats.inventory_stock_amount}</h3>
          </div>
        </div>

      </div>

      {/* সেকেন্ড রো কন্টেন্ট প্যানেল */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* শেষ ৩ মাসের বিক্রয়ের রিপোর্ট প্যানেল (বর্তমান মাস বাদে পেছনের ৩ মাসের জন্য) */}
        <div className="lg:col-span-2 bg-white rounded-xl border-2 border-[#417690] shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 flex justify-between items-center text-sm">
              <span className="flex items-center space-x-2 text-[#417690] font-bold">
                <span>🗓️</span> <span>Sales Overview (Last 3 Months)</span>
              </span>
              <span className="text-xs text-[#417690] bg-sky-50 border border-[#417690]/30 px-2.5 py-1 rounded-full font-bold">Gross Sales</span>
            </div>

            {/* পাশাপাশি ৩টি কলামের গ্রিড লেআউট */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {lastThreeMonthsSales.length > 0 ? (
                lastThreeMonthsSales.map((sale, index) => (
                  <div key={index} className="bg-sky-50/30 border border-[#417690]/40 rounded-xl p-4 flex flex-col justify-between text-center shadow-xs hover:shadow-md transition">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center space-x-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-[#417690]"></span>
                      <span>{sale.month_name}</span>
                    </div>
                    <div className="text-lg font-black text-[#417690] my-2">
                      {sale.total}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-400 text-xs py-4">কোনো বিক্রয় ডাটা পাওয়া যায়নি।</div>
              )}
            </div>
          </div>
        </div>

        {/* কুইক অ্যাকশন প্যানেল */}
        <div className="bg-white p-5 rounded-xl border-2 border-[#417690] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-[#417690] border-b border-gray-200 pb-2 mb-4 text-sm flex items-center space-x-2">
              <span>⚡</span> <span>Quick Actions</span>
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full text-center bg-gray-50 hover:bg-[#417690] hover:text-white text-gray-700 py-3 rounded-lg text-xs font-bold transition duration-200 border border-[#417690]/40 cursor-pointer shadow-xs"
              >
                ⚙️ Update Profile & Password
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-4">BusinessManager {new Date().getFullYear()}</p>
        </div>

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
            
            <div className="p-5 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                <span>🔐 Account Security Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-semibold outline-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleProfileUpdate} className="p-5 space-y-4">
              {updateMessage && (
                <div className="p-2 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                  {updateMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">User Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full rounded-lg border-gray-300 p-2.5 bg-gray-50 border focus:border-[#417690] focus:bg-white outline-none text-sm font-medium text-gray-800"
                  required
                />
              </div>

              <div className="border-t border-gray-100 pt-3">
                <label className="block text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••• (Leave blank to keep current)"
                  className="w-full rounded-lg border-gray-300 p-2.5 bg-gray-50 border focus:border-[#417690] focus:bg-white outline-none text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">Minimum 6 characters required if you want to change it.</p>
              </div>

              <div className="flex space-x-2 pt-2 border-t border-gray-200 mt-4">
                <button
                  type="submit"
                  className="w-full bg-[#417690] hover:bg-[#345e73] text-white p-2.5 rounded-lg font-bold text-sm shadow-md transition duration-150 cursor-pointer"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-lg font-semibold text-sm transition duration-150 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}