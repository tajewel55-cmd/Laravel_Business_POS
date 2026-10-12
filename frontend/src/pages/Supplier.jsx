import { useState, useEffect } from 'react';
import axios from 'axios';
import API from '../api';

const BASE_URL = 
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) || 
  'http://127.0.0.1:8000/api';

// Small inline SVG icons for text buttons
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

export default function Supplier() {
  const [suppliers, setSuppliers] = useState([]);

  const [supplierName, setSupplierName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  const [editId, setEditId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false); // State for Show All toggle

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-hide success or error messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/suppliers`, getAuthHeaders());
      const data = response.data?.data || response.data || [];
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching suppliers', err);
      setError('Failed to load data from server.');
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const resetForm = () => {
    setSupplierName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsActive(true);
    setEditId(null);
    setSelectedId(null);
  };

  const loadIntoForm = (item) => {
    setEditId(item.supplier_id);
    setSupplierName(item.supplier_name || '');
    setPhone(item.phone || '');
    setEmail(item.email || '');
    setAddress(item.address || '');
    setIsActive(Boolean(item.is_active ?? 1));
    setError('');
    setSuccess('');
  };

  const handleSelectRow = (item) => {
    if (selectedId === item.supplier_id) {
      setSelectedId(null);
      resetForm();
    } else {
      setSelectedId(item.supplier_id);
      setShowAllRows(false); // Turn off show all when a specific row is selected
      loadIntoForm(item);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      setError('Supplier Name is required.');
      return;
    }

    if (editId) {
      if (!window.confirm('Are you sure you want to update this supplier?')) {
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      supplier_name: supplierName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      is_active: isActive ? 1 : 0,
    };

    try {
      if (editId) {
        await axios.put(`${BASE_URL}/suppliers/${editId}`, payload, getAuthHeaders());
        setSuccess('Supplier updated successfully!');
      } else {
        await axios.post(`${BASE_URL}/suppliers`, payload, getAuthHeaders());
        setSuccess('Supplier created successfully!');
      }
      resetForm();
      fetchSuppliers();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Something went wrong!';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIconClick = async () => {
    if (!selectedId) {
      setError('Select a row first using the radio button.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await axios.delete(`${BASE_URL}/suppliers/${selectedId}`, getAuthHeaders());
        setSuccess('Supplier deleted successfully!');
        resetForm();
        fetchSuppliers();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete supplier.');
      }
    }
  };

  const handleShowClick = () => {
    setShowAllRows(true);
    setSelectedId(null);
    resetForm();
    setSuccess('Showing all supplier records.');
  };

  const handleClearClick = () => {
    resetForm();
    setSearchTerm('');
    setShowAllRows(false);
    fetchSuppliers();
    setSuccess('Form cleared and data refreshed.');
  };

  // Filtering Logic
  const filteredSuppliers = suppliers.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      (item.supplier_name && item.supplier_name.toLowerCase().includes(term)) ||
      (item.phone && item.phone.toLowerCase().includes(term)) ||
      (item.email && item.email.toLowerCase().includes(term)) ||
      String(item.supplier_id || '').toLowerCase().includes(term)
    );
  });

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => b.supplier_id - a.supplier_id);

  const isFilteringActive = searchTerm.trim() !== '';

  let displayedSuppliers = [];
  if (selectedId) {
    const selectedItem = suppliers.find((s) => s.supplier_id === selectedId);
    displayedSuppliers = selectedItem ? [selectedItem] : [];
  } else if (showAllRows || isFilteringActive) {
    displayedSuppliers = sortedSuppliers;
  } else {
    displayedSuppliers = suppliers.length > 0 ? [[...suppliers].sort((a, b) => b.supplier_id - a.supplier_id)[0]] : [];
  }

  const inputCls =
    'flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#417690]';
  const labelCls = 'w-32 shrink-0 text-xs font-semibold text-gray-700';

  return (
    <div className="max-w-7xl mx-auto p-2 sm:p-4" style={{ background: '#f2f4f5', minHeight: '100vh' }}>
      {/* Top header bar */}
      <div
        className="rounded-t-md shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3"
        style={{ background: BRAND }}
      >
        <h1 className="text-base sm:text-lg font-bold text-white tracking-wide text-center sm:text-left">
          Supplier Management
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
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowAllRows(false);
              }}
              className="px-3 py-1.5 text-sm text-black focus:outline-none w-full sm:w-64"
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

      {/* Two panel form */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Supplier Information Panel */}
          <div className="rounded overflow-hidden shadow-sm border bg-white" style={{ borderColor: BRAND }}>
            <div className="px-4 py-2 text-center font-semibold text-white text-sm" style={{ background: BRAND }}>
              Supplier Information
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center">
                <label className={labelCls}>Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              <div className="flex items-center">
                <label className={labelCls}>Phone</label>
                <input
                  type="text"
                  placeholder="e.g. 017xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="flex items-center">
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  placeholder="e.g. info@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Supplier Details Information Panel */}
          <div className="rounded overflow-hidden shadow-sm border flex flex-col justify-between bg-white" style={{ borderColor: BRAND }}>
            <div>
              <div className="px-4 py-2 text-center font-semibold text-white text-sm" style={{ background: BRAND }}>
                Supplier Details Information
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center">
                  <label className={labelCls}>Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Dhaka, Bangladesh"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="flex items-center">
                  <label className={labelCls}>Status</label>
                  <select
                    value={isActive ? 1 : 0}
                    onChange={(e) => setIsActive(e.target.value === '1')}
                    className={inputCls}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action bar with Text Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-3 px-4 mt-4 rounded shadow-md" style={{ background: BRAND }}>
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
        <div className="mt-3 text-xs font-semibold" style={{ color: BRAND_DARK }}>
          Click Update button to save changes, or Click Delete button to permanently delete data, or clear selection to cancel.
        </div>
      )}

      {/* Bottom supplier list table / Mobile Card view */}
      <div className="mt-6">
        {/* Desktop Table View (Hidden on small screens) */}
        <div className="hidden md:block rounded-t-md overflow-hidden shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-white text-xs uppercase whitespace-nowrap" style={{ background: BRAND }}>
                  <th className="px-3 py-2.5 w-16 text-center font-semibold border-r border-white/25">Sl.No.</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Supplier Name</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Phone</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Email</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Address</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {displayedSuppliers.length > 0 ? (
                  displayedSuppliers.map((item, index) => {
                    const isSelected = selectedId === item.supplier_id;
                    return (
                      <tr
                        key={item.supplier_id}
                        onClick={() => handleSelectRow(item)}
                        className="border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition"
                        style={{ background: isSelected ? BRAND_LIGHT : '#ffffff' }}
                      >
                        <td className="px-3 py-2 text-center border-r border-gray-200">
                          <div className="flex items-center justify-center gap-2">
                            <span>{index + 1}</span>
                            <input
                              type="radio"
                              name="rowSelect"
                              checked={isSelected}
                              onChange={() => handleSelectRow(item)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ accentColor: BRAND }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-900 whitespace-nowrap">
                          {item.supplier_name}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          {item.phone || 'N/A'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          {item.email || 'N/A'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          {item.address || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          <span
                            className="px-2 py-0.5 rounded text-white text-[11px]"
                            style={{ background: item.is_active ? BRAND : '#9ca3af' }}
                          >
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-gray-500 bg-white">
                      No suppliers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View (Visible only on small screens) */}
        <div className="block md:hidden space-y-3">
          {displayedSuppliers.length > 0 ? (
            displayedSuppliers.map((item, index) => {
              const isSelected = selectedId === item.supplier_id;
              return (
                <div
                  key={item.supplier_id}
                  onClick={() => handleSelectRow(item)}
                  className="p-3 rounded-lg border shadow-sm cursor-pointer transition relative"
                  style={{ background: isSelected ? BRAND_LIGHT : '#ffffff', borderColor: isSelected ? BRAND : '#e5e7eb' }}
                >
                  <div className="flex justify-between items-start mb-2 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rowSelectMobile"
                        checked={isSelected}
                        onChange={() => handleSelectRow(item)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ accentColor: BRAND }}
                      />
                      <span className="font-bold text-sm text-gray-900">#{index + 1} - {item.supplier_name}</span>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-white text-[10px]"
                      style={{ background: item.is_active ? BRAND : '#9ca3af' }}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-700">
                    <div><span className="font-semibold">Phone:</span> {item.phone || 'N/A'}</div>
                    <div><span className="font-semibold">Email:</span> {item.email || 'N/A'}</div>
                    <div className="col-span-2"><span className="font-semibold">Address:</span> {item.address || 'N/A'}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-gray-500 bg-white rounded border">
              No suppliers found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}