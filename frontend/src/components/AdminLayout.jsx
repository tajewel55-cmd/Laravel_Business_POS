import { useState, createContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';

export const RefreshContext = createContext();

export default function AdminLayout({ user, setUser }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); 
  const navigate = useNavigate();
  const inactivityTimerRef = useRef(null);

  const handleLogout = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await axios.post('http://127.0.0.1:8000/api/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user_menus');
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate, setUser]);

  const INACTIVITY_LIMIT = 35 * 60 * 1000; 

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_LIMIT);
  }, [handleLogout, INACTIVITY_LIMIT]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [resetInactivityTimer]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <RefreshContext.Provider value={triggerRefresh}>
      <div className="flex h-screen bg-gray-100 overflow-hidden w-full relative">
        
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#417690] text-white flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          
          <div className="h-16 flex items-center justify-center bg-[#355f75] text-lg font-bold tracking-wider shadow">
            BusinessPOS System
          </div>

          <div className="flex-1 overflow-y-auto">
            <Sidebar closeSidebar={() => setSidebarOpen(false)} />
          </div>
        </aside>

        {/* Main Content Wrapper */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          
          <header className="h-16 bg-white shadow flex items-center justify-between px-6 z-10 border-b border-gray-200">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-gray-700 focus:outline-none p-2 rounded hover:bg-gray-100 transition"
              aria-label="Toggle Sidebar"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">
              Welcome to BusinessPOS <span style={{ color: '#417390' }} className="capitalize">({user?.user_name || 'User'})</span>
            </h2>
            
            <div className="flex items-center gap-4">
               <button 
                 onClick={handleLogout}
                 className="bg-[#417690] hover:bg-red-600 text-white px-3 py-1.5 rounded transition text-xs font-medium shadow-sm cursor-pointer"
               >
                 Logout
               </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-1 sm:p-2 bg-gray-50">
            <Outlet key={refreshKey} />
          </div>
        </main>

        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)} 
            className="fixed inset-0 z-40 bg-black opacity-50 md:hidden transition-opacity"
          ></div>
        )}

        {sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(false)}
            className="fixed top-3 left-58 z-50 md:hidden text-white bg-gray-800 hover:bg-red-600 p-1 rounded-full shadow-md transition cursor-pointer"
            aria-label="Close Sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </RefreshContext.Provider>
  );
}