import { useState, useEffect } from 'react';
import API from '../api';

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

export default function Manufacturer() {
  const [manufacturers, setManufacturers] = useState([]);

  const [manufacturerName, setManufacturerName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  const [editId, setEditId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);

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

  const fetchManufacturers = async () => {
    try {
      const response = await API.get('/manufacturers');
      const data = response.data?.data || response.data || [];
      setManufacturers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching manufacturers', err);
      setError('Failed to load data from server.');
    }
  };

  useEffect(() => {
    fetchManufacturers();
  }, []);

  const resetForm = () => {
    setManufacturerName('');
    setIsActive(true);
    setEditId(null);
    setSelectedId(null);
  };

  const loadIntoForm = (item) => {
    setEditId(item.manufacturer_id);
    setManufacturerName(item.manufacturer_name || '');
    setIsActive(item.is_active ?? true);
    setError('');
    setSuccess('');
  };

  const handleSelectRow = (item) => {
    if (selectedId === item.manufacturer_id) {
      setSelectedId(null);
      resetForm();
    } else {
      setSelectedId(item.manufacturer_id);
      setShowAllRows(false);
      loadIntoForm(item);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!manufacturerName.trim()) {
      setError('Manufacturer Name is required.');
      return;
    }

    if (editId) {
      if (!window.confirm('Are you sure you want to update this manufacturer?')) {
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      manufacturer_name: manufacturerName.trim(),
      is_active: isActive ? 1 : 0,
    };

    try {
      if (editId) {
        await API.put(`/manufacturers/${editId}`, payload);
        setSuccess('Manufacturer updated successfully!');
      } else {
        await API.post('/manufacturers', payload);
        setSuccess('Manufacturer created successfully!');
      }
      resetForm();
      fetchManufacturers();
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
    if (window.confirm('Are you sure you want to delete this manufacturer?')) {
      try {
        await API.delete(`/manufacturers/${selectedId}`);
        setSuccess('Manufacturer deleted successfully!');
        resetForm();
        fetchManufacturers();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete manufacturer.');
      }
    }
  };

  const handleShowClick = () => {
    setShowAllRows(true);
    setSelectedId(null);
    resetForm();
    setSuccess('Showing all manufacturer records.');
  };

  const handleClearClick = () => {
    resetForm();
    setSearchTerm('');
    setShowAllRows(false);
    fetchManufacturers();
    setSuccess('Form cleared and data refreshed.');
  };

  // Filtering Logic
  const filteredManufacturers = manufacturers.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.manufacturer_name?.toLowerCase().includes(term) ||
      item.manufacturer_slug?.toLowerCase().includes(term) ||
      String(item.manufacturer_id || '').toLowerCase().includes(term)
    );
  });

  const sortedManufacturers = [...filteredManufacturers].sort((a, b) => b.manufacturer_id - a.manufacturer_id);

  const isFilteringActive = searchTerm.trim() !== '';

  let displayedManufacturers = [];
  if (selectedId) {
    const selectedItem = manufacturers.find((m) => m.manufacturer_id === selectedId);
    displayedManufacturers = selectedItem ? [selectedItem] : [];
  } else if (showAllRows) {
    displayedManufacturers = sortedManufacturers;
  } else if (isFilteringActive) {
    displayedManufacturers = sortedManufacturers;
  } else {
    displayedManufacturers = manufacturers.length > 0 ? [[...manufacturers].sort((a, b) => b.manufacturer_id - a.manufacturer_id)[0]] : [];
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
          Manufacturer Management
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
              placeholder="Search by name, slug..."
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

      {/* Form Section with Two Cards matching Supplier Design */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Card: Manufacturer Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Manufacturer Information
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Manufacturer Name</label>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="e.g. Healthcare, Beximco"
                    value={manufacturerName}
                    onChange={(e) => setManufacturerName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Manufacturer Details Information */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="text-white text-center font-semibold py-2.5 px-4 text-sm tracking-wide" style={{ background: BRAND }}>
              Manufacturer Details Information
            </div>
            <div className="p-4 bg-white flex flex-col gap-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <label className={labelCls}>Status</label>
                <div className="col-span-2">
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

        {/* Action bar with Text Buttons centered */}
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
              <th className="px-6 py-3 font-semibold border-r border-white/25">MANUFACTURER NAME</th>
              <th className="px-6 py-3 font-semibold border-r border-white/25">SLUG</th>
              <th className="px-6 py-3 w-40 font-semibold">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {displayedManufacturers.length > 0 ? (
              displayedManufacturers.map((item, index) => {
                const isSelected = selectedId === item.manufacturer_id;
                return (
                  <tr
                    key={item.manufacturer_id}
                    onClick={() => handleSelectRow(item)}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    style={{ background: isSelected ? BRAND_LIGHT : '#ffffff' }}
                  >
                    <td className="px-6 py-4 text-center text-gray-800 font-medium border-r border-gray-200">
                      <div className="flex items-center justify-center gap-3">
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
                    <td className="px-6 py-4 text-gray-800 font-medium border-r border-gray-200">
                      {item.manufacturer_name}
                    </td>
                    <td className="px-6 py-4 text-gray-500 border-r border-gray-200">
                      {item.manufacturer_slug}
                    </td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">
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
                <td colSpan="4" className="text-center py-6 text-gray-500 bg-white">
                  No manufacturers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {displayedManufacturers.length > 0 ? (
          displayedManufacturers.map((item, index) => {
            const isSelected = selectedId === item.manufacturer_id;
            return (
              <div
                key={item.manufacturer_id}
                onClick={() => handleSelectRow(item)}
                className="border rounded-lg p-4 shadow-sm flex flex-col gap-3 cursor-pointer transition"
                style={{ background: isSelected ? BRAND_LIGHT : '#ffffff', borderColor: isSelected ? BRAND : '#e5e7eb' }}
              >
                <div className="flex justify-between items-center border-b pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rowSelectMobile"
                      checked={isSelected}
                      onChange={() => handleSelectRow(item)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ accentColor: BRAND }}
                    />
                    <span className="text-xs font-bold bg-[#417690] text-white px-2 py-0.5 rounded">
                      SL.NO.: {index + 1}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${item.is_active ? 'bg-[#417690]' : 'bg-red-600'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold text-xs">Manufacturer Name:</span>
                    <span className="text-gray-800 font-medium">{item.manufacturer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold text-xs">Slug:</span>
                    <span className="text-gray-500">{item.manufacturer_slug}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-gray-500 border rounded-lg bg-gray-50">
            No manufacturers found.
          </div>
        )}
      </div>
    </div>
  );
}