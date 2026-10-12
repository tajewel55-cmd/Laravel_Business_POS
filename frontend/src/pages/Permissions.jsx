import { useState, useEffect } from 'react';
import API from '../api';

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

export default function Permissions() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [menus, setMenus] = useState([]);
  const [selectedMenus, setSelectedMenus] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Auto-hide messages after 2 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchRoles = async () => {
    try {
      const res = await API.get('/roles');
      const data = res.data?.data || res.data || [];
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching roles', err);
    }
  };

  const fetchMenus = async () => {
    try {
      const res = await API.get('/menus');
      const data = res.data?.data || res.data || [];
      setMenus(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching menus', err);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchMenus();
  }, []);

  const handleRoleChange = async (e) => {
    const roleId = e.target.value;
    setSelectedRole(roleId);
    setMessage('');

    if (!roleId) {
      setSelectedMenus([]);
      return;
    }

    try {
      const res = await API.get(`/roles/${roleId}/permissions`);
      const permissionsData = res.data?.permissions || res.data?.data || res.data || [];
      if (Array.isArray(permissionsData)) {
        const formattedPermissions = permissionsData.map(id => Number(id));
        setSelectedMenus(formattedPermissions);
      } else {
        setSelectedMenus([]);
      }
    } catch (err) {
      console.error('Error fetching role permissions', err);
      setSelectedMenus([]);
    }
  };

  // মেইন মেনু এবং সাবমেনু আলাদা করার লজিক
  const mainMenus = menus
    .filter(menu => !menu.parent_id)
    .sort((a, b) =>
      (a.menu_title || '').localeCompare(b.menu_title || '', undefined, {
        sensitivity: 'base'
      })
    );

  const getSubMenus = (parentId) =>
    menus
      .filter(menu => Number(menu.parent_id) === Number(parentId))
      .sort((a, b) =>
        (a.menu_title || '').localeCompare(b.menu_title || '', undefined, {
          sensitivity: 'base'
        })
      );

  // স্মার্ট চেক বক্স হ্যান্ডলার
  const handleCheckboxChange = (menuId, isMain = false, parentId = null) => {
    const subMenus = isMain ? getSubMenus(menuId) : [];
    const subMenuIds = subMenus.map(sm => Number(sm.menu_id));
    const numericMenuId = Number(menuId);
    const numericParentId = parentId ? Number(parentId) : null;

    if (selectedMenus.includes(numericMenuId)) {
      if (isMain) {
        setSelectedMenus(selectedMenus.filter(id => id !== numericMenuId && !subMenuIds.includes(id)));
      } else {
        setSelectedMenus(selectedMenus.filter(id => id !== numericMenuId));
      }
    } else {
      if (isMain) {
        const newSelected = [...selectedMenus, numericMenuId, ...subMenuIds];
        setSelectedMenus([...new Set(newSelected)]);
      } else {
        let newSelected = [...selectedMenus, numericMenuId];
        if (numericParentId && !newSelected.includes(numericParentId)) {
          newSelected.push(numericParentId);
        }
        setSelectedMenus([...new Set(newSelected)]);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole) {
      alert('Please select a role first!');
      return;
    }

    setLoading(true);
    try {
      await API.post(`/roles/${selectedRole}/permissions`, {
        menu_ids: selectedMenus
      });

      setMessage('Permissions updated successfully!');
    } catch (err) {
      console.error('Error saving permissions', err);
      setMessage(err.response?.data?.message || 'Failed to update permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearClick = () => {
    setSelectedRole('');
    setSelectedMenus([]);
    setMessage('Form cleared.');
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
          Role Permissions Management
        </h1>

        <div className="flex-1 px-2 text-center">
          {message && (
            <span className={`text-xs px-3 py-1 rounded shadow-sm inline-block font-medium ${message.toLowerCase().includes('success') || message.toLowerCase().includes('cleared') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          {/* Left Card: Role Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm h-fit">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Role Information
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Select Role</label>
                <div className="col-span-2">
                  <select
                    value={selectedRole}
                    onChange={handleRoleChange}
                    className={inputCls}
                  >
                    <option value="">-- Choose a Role --</option>
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Menu Permissions Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Assign Menu Permissions
            </div>
            <div className="p-4 bg-white flex flex-col gap-3 max-h-96 overflow-y-auto">
              {selectedRole ? (
                mainMenus.length > 0 ? (
                  mainMenus.map((mainMenu) => {
                    const subMenus = getSubMenus(mainMenu.menu_id);
                    return (
                      <div key={mainMenu.menu_id} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                        {/* মেইন মেনু চেক বক্স */}
                        <label className="flex items-center space-x-3 cursor-pointer font-semibold text-gray-800">
                          <input
                            type="checkbox"
                            checked={selectedMenus.includes(Number(mainMenu.menu_id))}
                            onChange={() => handleCheckboxChange(mainMenu.menu_id, true)}
                            className="w-4 h-4 text-[#417690] border-gray-350 rounded focus:ring-[#417690]"
                            style={{ accentColor: BRAND }}
                          />
                          <span>{mainMenu.menu_title} <span className="text-xs text-blue-600 font-normal">(Main Menu)</span></span>
                        </label>

                        {/* সাবমেনুগুলো */}
                        {subMenus.length > 0 && (
                          <div className="ml-7 mt-2 space-y-2 border-l-2 border-gray-300 pl-4">
                            {subMenus.map((subMenu) => (
                              <label key={subMenu.menu_id} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedMenus.includes(Number(subMenu.menu_id))}
                                  onChange={() => handleCheckboxChange(subMenu.menu_id, false, mainMenu.menu_id)}
                                  className="w-4 h-4 text-[#417690] border-gray-350 rounded focus:ring-[#417690]"
                                  style={{ accentColor: BRAND }}
                                />
                                <span className="text-sm text-gray-700">
                                  {subMenu.menu_title} <span className="text-xs text-gray-500 font-normal">(Sub-menu)</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-500 text-sm">No menus available.</div>
                )
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm italic">
                  Please select a role first to assign permissions.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Action bar with Centered Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-3 px-4 mt-6 rounded shadow-md" style={{ background: BRAND }}>
          {selectedRole && (
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow disabled:opacity-50"
              style={{ background: BRAND_DARK }}
            >
              <IconPlus size={14} />
              {loading ? 'Saving...' : 'Save Permissions'}
            </button>
          )}
          <button
            type="button"
            onClick={handleClearClick}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
            style={{ background: BRAND_DARK }}
          >
            <IconRefresh size={14} />
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}