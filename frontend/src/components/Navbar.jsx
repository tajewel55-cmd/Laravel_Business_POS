import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Navbar({ setUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post('http://127.0.0.1:8000/api/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      navigate('/login');
    }
  };

  return (
    <nav className="bg-[#417690] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <span className="text-xl font-bold tracking-wide">BusinessPOS Administration</span>
          </div>

          {/* Desktop Menu - স্ট্যাটিক লিংকগুলো রিমুভ করা হয়েছে */}
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <button 
              onClick={handleLogout}
              className="bg-[#355f75] hover:bg-[#2c4e60] px-3 py-1.5 rounded transition"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-white focus:outline-none p-2"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-[#355f75] px-4 pt-2 pb-4 space-y-2">
          <button 
            onClick={handleLogout}
            className="w-full text-left py-2 px-2 bg-red-600 rounded hover:bg-red-700 transition mt-2"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}