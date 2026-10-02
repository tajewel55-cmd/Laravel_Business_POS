import { useState, useEffect } from 'react';
import axios from 'axios';

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

export default function Product() {
  const [products, setProducts] = useState([]);
  const [packSizes, setPackSizes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  const [productName, setProductName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [packSizeId, setPackSizeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedManufacturerFilter, setSelectedManufacturerFilter] = useState('');

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

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchData = async () => {
    try {
      const [prodRes, packRes, catRes, manRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/products', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/pack-sizes', getAuthHeaders()).catch(() => ({ data: { data: [] } })),
        axios.get('http://127.0.0.1:8000/api/categories', getAuthHeaders()).catch(() => ({ data: { data: [] } })),
        axios.get('http://127.0.0.1:8000/api/manufacturers', getAuthHeaders()).catch(() => ({ data: { data: [] } })),
      ]);
      setProducts(prodRes.data.data || []);
      setPackSizes(packRes.data.data || []);
      setCategories(catRes.data.data || []);
      setManufacturers(manRes.data.data || []);
    } catch (err) {
      console.error('Error fetching data', err);
      setError('Failed to load data from server.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setProductName('');
    setBarcode('');
    setPackSizeId('');
    setCategoryId('');
    setManufacturerId('');
    setPurchasePrice('');
    setSalePrice('');
    setIsActive(true);
    setEditId(null);
    setSelectedId(null);
  };

  const loadIntoForm = (item) => {
    setEditId(item.product_id);
    setProductName(item.product_name || '');
    setBarcode(item.barcode || '');
    setPackSizeId(item.pack_size_id || '');
    setCategoryId(item.category_id || '');
    setManufacturerId(item.manufacturer_id || '');
    setPurchasePrice(item.purchase_price || '');
    setSalePrice(item.sale_price || '');
    setIsActive(item.is_active ?? 1);
    setError('');
    setSuccess('');
  };

  const handleSelectRow = (item) => {
    if (selectedId === item.product_id) {
      setSelectedId(null);
      resetForm();
    } else {
      setSelectedId(item.product_id);
      setShowAllRows(false);
      loadIntoForm(item);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editId) {
      if (!window.confirm('Are you sure you want to update this product?')) {
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      product_name: productName.trim(),
      barcode: barcode.trim(),
      pack_size_id: packSizeId,
      category_id: categoryId,
      manufacturer_id: manufacturerId,
      purchase_price: parseFloat(purchasePrice) || 0,
      sale_price: parseFloat(salePrice) || 0,
      is_active: isActive ? 1 : 0,
    };

    try {
      if (editId) {
        await axios.put(`http://127.0.0.1:8000/api/products/${editId}`, payload, getAuthHeaders());
        setSuccess('Product updated successfully!');
      } else {
        await axios.post('http://127.0.0.1:8000/api/products', payload, getAuthHeaders());
        setSuccess('Product created successfully!');
      }
      resetForm();
      fetchData();
    } catch (err) {
      const errorMsg =
        err.response?.data?.errors?.barcode?.[0] ||
        err.response?.data?.message ||
        'Something went wrong!';
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
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/products/${selectedId}`, getAuthHeaders());
        setSuccess('Product deleted successfully!');
        resetForm();
        fetchData();
      } catch (err) {
        setError('Failed to delete product.');
      }
    }
  };

  const handleShowClick = () => {
    setShowAllRows(true);
    setSelectedId(null);
    resetForm();
    setSuccess('Showing all product records.');
  };

  const handleClearClick = () => {
    resetForm();
    setSearchTerm('');
    setSelectedCategoryFilter('');
    setSelectedManufacturerFilter('');
    setShowAllRows(false);
    fetchData();
    setSuccess('Form cleared and data refreshed.');
  };

  // Filtering Logic
  const filteredProducts = products.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.product_name?.toLowerCase().includes(term) ||
      item.barcode?.toLowerCase().includes(term) ||
      String(item.product_id).toLowerCase().includes(term);

    const matchesCategory = selectedCategoryFilter ? String(item.category_id) === String(selectedCategoryFilter) : true;
    const matchesManufacturer = selectedManufacturerFilter ? String(item.manufacturer_id) === String(selectedManufacturerFilter) : true;

    return matchesSearch && matchesCategory && matchesManufacturer;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => b.product_id - a.product_id);

  const isFilteringActive = searchTerm.trim() !== '' || selectedCategoryFilter !== '' || selectedManufacturerFilter !== '';

  let displayedProducts = [];
  if (selectedId) {
    const selectedItem = products.find((p) => p.product_id === selectedId);
    displayedProducts = selectedItem ? [selectedItem] : [];
  } else if (showAllRows) {
    displayedProducts = sortedProducts;
  } else if (isFilteringActive) {
    displayedProducts = sortedProducts;
  } else {
    displayedProducts = products.length > 0 ? [[...products].sort((a, b) => b.product_id - a.product_id)[0]] : [];
  }

  const getPackName = (id) => {
    const found = packSizes.find((p) => String(p.pack_size_id || p.id) === String(id));
    return found ? found.pack_size_name || found.name : id;
  };

  const getCategoryName = (id) => {
    const found = categories.find((c) => String(c.category_id || c.id) === String(id));
    return found ? found.category_name || found.name : id;
  };

  const getManufacturerName = (id) => {
    const found = manufacturers.find((m) => String(m.manufacturer_id || m.id) === String(id));
    return found ? found.manufacturer_name || found.name : id;
  };

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
          Product Management
        </h1>

        <div className="flex-1 px-2 text-center">
          {error && <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{error}</span>}
          {success && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded shadow-sm inline-block font-medium">{success}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center">
          {/* Optional Extra Filters on Header */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => {
              setSelectedCategoryFilter(e.target.value);
              setShowAllRows(false);
            }}
            className="px-2 py-1.5 text-xs bg-white rounded text-black focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((item) => (
              <option key={item.category_id || item.id} value={item.category_id || item.id}>
                {item.category_name || item.name}
              </option>
            ))}
          </select>

          <select
            value={selectedManufacturerFilter}
            onChange={(e) => {
              setSelectedManufacturerFilter(e.target.value);
              setShowAllRows(false);
            }}
            className="px-2 py-1.5 text-xs bg-white rounded text-black focus:outline-none"
          >
            <option value="">All Manufacturers</option>
            {manufacturers.map((item) => (
              <option key={item.manufacturer_id || item.id} value={item.manufacturer_id || item.id}>
                {item.manufacturer_name || item.name}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-white rounded overflow-hidden shadow-sm">
            <input
              type="text"
              placeholder="Search by name, barcode..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowAllRows(false);
              }}
              className="px-3 py-1.5 text-sm text-black focus:outline-none w-full sm:w-48"
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
          {/* Product Information Panel */}
          <div className="rounded overflow-hidden shadow-sm border bg-white" style={{ borderColor: BRAND }}>
            <div className="px-4 py-2 text-center font-semibold text-white text-sm" style={{ background: BRAND }}>
              Product Information
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center">
                <label className={labelCls}>Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              <div className="flex items-center">
                <label className={labelCls}>Pack ID</label>
                <select
                  value={packSizeId}
                  onChange={(e) => setPackSizeId(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Choose UNIT</option>
                  {packSizes.map((item) => (
                    <option key={item.pack_size_id || item.id} value={item.pack_size_id || item.id}>
                      {item.pack_size_name || item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <label className={labelCls}>Category ID</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Select Category</option>
                  {categories.map((item) => (
                    <option key={item.category_id || item.id} value={item.category_id || item.id}>
                      {item.category_name || item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <label className={labelCls}>Manufacturer</label>
                <select
                  value={manufacturerId}
                  onChange={(e) => setManufacturerId(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Select Manufacturer</option>
                  {manufacturers.map((item) => (
                    <option key={item.manufacturer_id || item.id} value={item.manufacturer_id || item.id}>
                      {item.manufacturer_name || item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Product Details Information Panel */}
          <div className="rounded overflow-hidden shadow-sm border flex flex-col justify-between bg-white" style={{ borderColor: BRAND }}>
            <div>
              <div className="px-4 py-2 text-center font-semibold text-white text-sm" style={{ background: BRAND }}>
                Product Details Information
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center">
                  <label className={labelCls}>Barcode</label>
                  <input
                    type="text"
                    placeholder="e.g. 123456789"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>

                <div className="flex items-center">
                  <label className={labelCls}>Purchase Price</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>

                <div className="flex items-center">
                  <label className={labelCls}>Sale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    required
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
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
            style={{ background: BRAND_DARK }}
          >
            <IconPlus size={14} />
            {editId ? 'Update' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleDeleteIconClick}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-xs font-semibold hover:opacity-90 transition shadow"
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

      {/* Bottom product list table / Mobile Card view */}
      <div className="mt-6">
        {/* Desktop Table View (Hidden on small screens) */}
        <div className="hidden md:block rounded-t-md overflow-hidden shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-white text-xs uppercase whitespace-nowrap" style={{ background: BRAND }}>
                  <th className="px-3 py-2.5 w-16 text-center font-semibold border-r border-white/25">Sl.No.</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Product Name</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Barcode</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Pack</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Category</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Manufacturer</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Purchase</th>
                  <th className="px-3 py-2.5 font-semibold border-r border-white/25">Sale</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {displayedProducts.length > 0 ? (
                  displayedProducts.map((item, index) => {
                    const isSelected = selectedId === item.product_id;
                    return (
                      <tr
                        key={item.product_id}
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
                          {item.product_name}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          {item.barcode || 'N/A'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          {getPackName(item.pack_size_id)}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          {getCategoryName(item.category_id)}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          {getManufacturerName(item.manufacturer_id)}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          ৳{item.purchase_price}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-xs text-gray-700 whitespace-nowrap">
                          ৳{item.sale_price}
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
                    <td colSpan="9" className="text-center py-6 text-gray-500 bg-white">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View (Visible only on small screens) */}
        <div className="block md:hidden space-y-3">
          {displayedProducts.length > 0 ? (
            displayedProducts.map((item, index) => {
              const isSelected = selectedId === item.product_id;
              return (
                <div
                  key={item.product_id}
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
                      <span className="font-bold text-sm text-gray-900">#{index + 1} - {item.product_name}</span>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-white text-[10px]"
                      style={{ background: item.is_active ? BRAND : '#9ca3af' }}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-700">
                    <div><span className="font-semibold">Barcode:</span> {item.barcode || 'N/A'}</div>
                    <div><span className="font-semibold">Pack:</span> {getPackName(item.pack_size_id)}</div>
                    <div><span className="font-semibold">Category:</span> {getCategoryName(item.category_id)}</div>
                    <div><span className="font-semibold">Manufacturer:</span> {getManufacturerName(item.manufacturer_id)}</div>
                    <div><span className="font-semibold">Purchase:</span> ৳{item.purchase_price}</div>
                    <div><span className="font-semibold">Sale:</span> ৳{item.sale_price}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-gray-500 bg-white rounded border">
              No products found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}