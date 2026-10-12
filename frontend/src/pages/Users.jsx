import { useState, useEffect } from 'react';
import API from '../api';

// Small inline SVG icons
const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconX = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconList = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconRefresh = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.23-5.23" />
  </svg>
);
const IconSearch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BRAND = '#417690';
const BRAND_DARK = '#2f5163';
const BRAND_LIGHT = '#eaf1f4';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  // Form State
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [editId, setEditId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-hide messages after 3 seconds safely
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const fetchData = async () => {
    try {
      const [userRes, roleRes] = await Promise.all([
        API.get('/users'),
        API.get('/roles')
      ]);
      setUsers(userRes.data?.data || []);
      setRoles(roleRes.data?.data || []);
    } catch (err) {
      console.error('Error fetching data', err);
      setError(err.response?.data?.message || 'Failed to load data from server.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setUserName('');
    setPassword('');
    setRoleId('');
    setEditId(null);
    setSelectedId(null);
  };

  const loadIntoForm = (user) => {
    setEditId(user.user_id);
    setUserName(user.user_name || '');
    setPassword(''); // Never expose current password in UI
    setRoleId(user.role_id || user.role?.role_id || '');
    setError('');
    setSuccess('');
  };

  const handleSelectRow = (user) => {
    if (selectedId === user.user_id) {
      setSelectedId(null);
      resetForm();
    } else {
      setSelectedId(user.user_id);
      setShowAllRows(false);
      loadIntoForm(user);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editId) {
      if (!window.confirm('Are you sure you want to update this user?')) {
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (editId) {
        const updateData = {
          user_name: userName,
          role_id: roleId,
        };
        // Only append password if the user actually typed a new one
        if (password.trim()) {
          updateData.password = password;
        }

        await API.put(`/users/${editId}`, updateData);
        setSuccess('User updated successfully!');
      } else {
        const submitData = {
          user_name: userName,
          password: password,
          role_id: roleId,
        };
        await API.post('/users', submitData);
        setSuccess('User created successfully!');
      }
      resetForm();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong!');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIconClick = async () => {
    if (!selectedId) {
      setError('Select a row first using the radio button.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await API.delete(`/users/${selectedId}`);
        setSuccess('User deleted successfully!');
        resetForm();
        fetchData();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete user.');
      }
    }
  };

  const handleShowClick = () => {
    setShowAllRows(true);
    setSelectedId(null);
    resetForm();
    setSuccess('Showing all user records.');
  };

  const handleClearClick = () => {
    resetForm();
    setSearchTerm('');
    setShowAllRows(false);
    fetchData();
    setSuccess('Form cleared and data refreshed.');
  };

  const formatRoleName = (name) => {
    if (!name) return '';
    return name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getRoleName = (user) => {
    if (user.role && user.role.role_name) {
      return formatRoleName(user.role.role_name);
    }
    const role = roles.find((r) => String(r.role_id) === String(user.role_id));
    if (role && role.role_name) {
      return formatRoleName(role.role_name);
    }
    return 'N/A';
  };

  // Filtering Logic
  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    const roleNameStr = getRoleName(user).toLowerCase();
    const userNameStr = (user.user_name || '').toLowerCase();
    const userIdStr = String(user.user_id || '').toLowerCase();

    return userNameStr.includes(term) || roleNameStr.includes(term) || userIdStr.includes(term);
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => b.user_id - a.user_id);
  const isFilteringActive = searchTerm.trim() !== '';

  let displayedUsers = [];
  if (selectedId) {
    const selectedItem = users.find((u) => u.user_id === selectedId);
    displayedUsers = selectedItem ? [selectedItem] : [];
  } else if (showAllRows || isFilteringActive) {
    displayedUsers = sortedUsers;
  } else {
    displayedUsers = users.length > 0 ? [[...users].sort((a, b) => b.user_id - a.user_id)[0]] : [];
  }

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
          User Management
        </h1>

        <div className="flex-1 px-2 text-center">
          {error && <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{error}</span>}
          {success && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{success}</span>}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <span className="text-sm font-semibold text-white whitespace-nowrap">Search :</span>
          <div className="flex items-center bg-white rounded overflow-hidden w-full sm:w-auto shadow-sm">
            <input
              type="text"
              placeholder="Search by username, role..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowAllRows(false);
              }}
              className="px-3 py-1.5 text-sm text-black focus:outline-none w-full sm:w-52"
            />
            <button
              type="button"
              className="px-3 py-1.5 h-full text-white flex items-center justify-center"
              style={{ background: BRAND_DARK }}
            >
              <IconSearch size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Form Section with Two Cards */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Card: User Login Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              User Credentials
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Username</label>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Enter Username"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Password</label>
                <div className="col-span-2">
                  <input
                    type="password"
                    placeholder={editId ? "Leave blank to keep old" : "Enter Password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editId}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: User Role Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Role Assignment
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Role Name</label>
                <div className="col-span-2">
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    required
                    className={inputCls}
                  >
                    <option value="">Select Role</option>
                    {roles.map((r) => (
                      <option key={r.role_id} value={r.role_id}>
                        {formatRoleName(r.role_name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Action bar with Text Buttons Centered */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-3 px-4 mt-6 rounded shadow-md" style={{ background: BRAND }}>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow disabled:opacity-50"
            style={{ background: BRAND_DARK }}
          >
            <IconPlus size={14} />
            {loading ? 'Processing...' : editId ? 'Update' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleDeleteIconClick}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow disabled:opacity-50"
            style={{ background: BRAND_DARK }}
          >
            <IconX size={14} />
            Delete
          </button>
          <button
            type="button"
            onClick={handleShowClick}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
            style={{ background: BRAND_DARK }}
          >
            <IconList size={14} />
            Show
          </button>
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

      {editId && (
        <div className="mb-4 text-xs font-semibold" style={{ color: BRAND_DARK }}>
          Click Update button to save changes, or Click Delete button to permanently delete data, or clear selection to cancel.
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-white text-xs uppercase tracking-wider" style={{ background: BRAND }}>
              <th className="px-6 py-3 w-28 text-center font-semibold border-r border-white/25">SL.NO.</th>
              <th className="px-6 py-3 font-semibold border-r border-white/25">USERNAME</th>
              <th className="px-6 py-3 font-semibold border-r border-white/25">PASSWORD</th>
              <th className="px-6 py-3 font-semibold">ROLE NAME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {displayedUsers.length > 0 ? (
              displayedUsers.map((user, index) => {
                const isSelected = selectedId === user.user_id;
                return (
                  <tr
                    key={user.user_id}
                    onClick={() => handleSelectRow(user)}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    style={{ background: isSelected ? BRAND_LIGHT : '#ffffff' }}
                  >
                    <td className="px-6 py-4 text-center text-gray-800 font-medium border-r border-gray-200">
                      <div className="flex items-center justify-center gap-3">
                        <span>{index + 1}</span>
                        <input
                          type="radio"
                          name="rowSelectUser"
                          checked={isSelected}
                          onChange={() => handleSelectRow(user)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: BRAND }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-medium border-r border-gray-200">
                      {user.user_name}
                    </td>
                    <td className="px-6 py-4 text-gray-400 italic border-r border-gray-200">
                      ********
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-medium">
                      {getRoleName(user)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="text-center py-6 text-gray-500 bg-white">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {displayedUsers.length > 0 ? (
          displayedUsers.map((user, index) => {
            const isSelected = selectedId === user.user_id;
            return (
              <div
                key={user.user_id}
                onClick={() => handleSelectRow(user)}
                className="border rounded-lg p-4 shadow-sm flex flex-col gap-3 cursor-pointer transition"
                style={{ background: isSelected ? BRAND_LIGHT : '#ffffff', borderColor: isSelected ? BRAND : '#e5e7eb' }}
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rowSelectUserMobile"
                      checked={isSelected}
                      onChange={() => handleSelectRow(user)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ accentColor: BRAND }}
                    />
                    <span className="text-xs font-bold bg-[#417690] text-white px-2 py-0.5 rounded">
                      SL.NO.: {index + 1}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold text-xs">Username:</span>
                    <span className="text-gray-800 font-medium">{user.user_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold text-xs">Password:</span>
                    <span className="text-gray-400 italic">********</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold text-xs">Role Name:</span>
                    <span className="text-gray-800 font-medium">{getRoleName(user)}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-gray-500 border rounded-lg bg-gray-50">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
}