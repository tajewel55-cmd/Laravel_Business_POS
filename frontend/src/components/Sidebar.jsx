import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { FaChevronRight } from 'react-icons/fa';
import { RefreshContext } from './AdminLayout';

export default function Sidebar({ closeSidebar }) {
  const [userMenus, setUserMenus] = useState(() => {
    try {
      const cached = localStorage.getItem('user_menus');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [openMenu, setOpenMenu] = useState(null);
  const location = useLocation();
  const triggerRefresh = useContext(RefreshContext);

  const sortedUserMenus = useMemo(() => {
    if (!Array.isArray(userMenus)) return [];

    return [...userMenus]
      .map((menu) => {
        const sortedSubMenus = Array.isArray(menu.sub_menus)
          ? [...menu.sub_menus].sort((a, b) =>
              (a.menu_title || '').localeCompare(b.menu_title || '', undefined, {
                sensitivity: 'base',
                numeric: true,
              })
            )
          : [];

        return { ...menu, sub_menus: sortedSubMenus };
      })
      .sort((a, b) =>
        (a.menu_title || '').localeCompare(b.menu_title || '', undefined, {
          sensitivity: 'base',
          numeric: true,
        })
      );
  }, [userMenus]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchUserMenus = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const response = await axios.get('http://127.0.0.1:8000/api/user-menus', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        const menus = Array.isArray(response.data)
          ? response.data
          : response.data?.data || response.data?.menus || [];

        if (Array.isArray(menus) && menus.length > 0) {
          const stringified = JSON.stringify(menus);
          if (stringified !== localStorage.getItem('user_menus')) {
            setUserMenus(menus);
            localStorage.setItem('user_menus', stringified);
          }
        }
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error('Error fetching user menus:', err);
        }
      }
    };

    fetchUserMenus();
    return () => controller.abort();
  }, []);

  const getMenuPath = useCallback((menu) => {
    if (!menu) return '#';
    let path = menu.route_name ? menu.route_name : `/${menu.menu_slug}`;
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }
    return path;
  }, []);

  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/') {
      setOpenMenu(null); // ড্যাশবোর্ডে আসলে সব সাবমেনু বন্ধ হয়ে যাবে
      return;
    }

    sortedUserMenus.forEach((menu) => {
      if (menu.sub_menus && menu.sub_menus.length > 0) {
        const matchFound = menu.sub_menus.some(
          (sub) => getMenuPath(sub) === location.pathname
        );
        if (matchFound) {
          setOpenMenu(menu.menu_id);
        }
      }
    });
  }, [location.pathname, sortedUserMenus, getMenuPath]);

  const toggleMenu = (menuId) => {
    setOpenMenu((prev) => (prev === menuId ? null : menuId));
  };

  const handleLinkClick = (path) => {
    if (location.pathname === path && triggerRefresh) {
      triggerRefresh();
    }
    if (path === '/dashboard') {
      setOpenMenu(null); // ড্যাশবোর্ডে ক্লিক করলে ড্রপডাউন রিসেট হবে
    }
    if (closeSidebar) {
      closeSidebar();
    }
  };

  return (
    <aside className="w-64 bg-[#2c4e60] text-white h-full shadow-md flex flex-col justify-between select-none">
      <div
        className="px-2 py-3 flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Dashboard Link */}
        <div className="mb-3 border-b border-white/10 pb-2">
          <Link
            to="/dashboard"
            onClick={() => handleLinkClick('/dashboard')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-[15px] font-medium ${
              location.pathname === '/dashboard'
                ? 'bg-[#203947] text-white font-semibold shadow-inner'
                : 'hover:bg-white/10 text-blue-50'
            }`}
          >
            📊 <span>Dashboard</span>
          </Link>
        </div>

        {/* Menu List */}
        <ul className="space-y-2">
          {sortedUserMenus.map((menu) => {
            const isOpen = openMenu === menu.menu_id;
            const hasSubMenus = menu.sub_menus && menu.sub_menus.length > 0;
            const isParentActive =
              hasSubMenus &&
              menu.sub_menus.some((sub) => getMenuPath(sub) === location.pathname);

            return (
              <li key={menu.menu_id} className="border-b border-white/10 pb-2">
                {hasSubMenus ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleMenu(menu.menu_id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-[15px] font-medium cursor-pointer ${
                        isParentActive || isOpen
                          ? 'bg-[#203947] text-white font-semibold'
                          : 'hover:bg-white/10 text-blue-50'
                      }`}
                    >
                      <span>{menu.menu_title}</span>
                      <span
                        className={`transform transition-transform duration-200 ease-in-out ${
                          isOpen ? 'rotate-90' : 'rotate-0'
                        }`}
                      >
                        <FaChevronRight size={12} />
                      </span>
                    </button>

                    <div
                      className={`grid transition-all duration-200 ease-in-out overflow-hidden ${
                        isOpen
                          ? 'grid-rows-[1fr] opacity-100 mt-1.5 mb-3 pb-2'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <ul className="space-y-1.5 pl-3 border-l-2 border-white/15 ml-2.5">
                          {menu.sub_menus.map((subMenu) => {
                            const subPath = getMenuPath(subMenu);
                            const isActive = location.pathname === subPath;

                            return (
                              <li key={subMenu.menu_id}>
                                <Link
                                  to={subPath}
                                  onClick={() => handleLinkClick(subPath)}
                                  className={`block px-3 py-1.5 rounded-md transition-all text-[13.5px] font-medium ${
                                    isActive
                                      ? 'bg-[#1b313e] text-white font-semibold shadow-inner translate-x-1 border-l-2 border-cyan-400'
                                      : 'text-gray-200 hover:bg-white/10 hover:translate-x-1'
                                  }`}
                                >
                                  {subMenu.menu_title}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    to={getMenuPath(menu)}
                    onClick={() => handleLinkClick(getMenuPath(menu))}
                    className={`block px-3 py-2 rounded-lg transition-all text-[15px] font-medium ${
                      location.pathname === getMenuPath(menu)
                        ? 'bg-[#203947] text-white font-semibold shadow-inner'
                        : 'hover:bg-white/10 text-blue-50'
                    }`}
                  >
                    {menu.menu_title}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}