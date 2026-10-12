import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../api';

export default function Report_Stock() {
  const [stockData, setStockData] = useState([]);
  const [summary, setSummary] = useState({ total_products: 0, total_stock_qty: 0, total_stock_value: 0 });

  // Dropdown lists for filters
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [catRes, manRes] = await Promise.all([
          API.get('/categories', getAuthHeaders()).catch(() => ({ data: { data: [] } })),
          API.get('/manufacturers', getAuthHeaders()).catch(() => ({ data: { data: [] } })),
        ]);
        setCategories(catRes.data?.data || catRes.data || []);
        setManufacturers(manRes.data?.data || manRes.data || []);
      } catch (err) {
        console.error('Error loading filter options', err);
      }
    };
    fetchFilterOptions();
  }, []);

  const fetchStockReport = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (stockFilter) params.append('stock_filter', stockFilter);
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedManufacturer) params.append('manufacturer_id', selectedManufacturer);

      const queryString = params.toString();
      const url = `/reports/stock${queryString ? `?${queryString}` : ''}`;

      const response = await API.get(url, getAuthHeaders());

      if (response.data && (response.data.success !== false)) {
        const dataList = response.data.data || response.data || [];
        setStockData(Array.isArray(dataList) ? dataList : []);
        setSummary({
          total_products: response.data.total_products || 0,
          total_stock_qty: response.data.total_stock_qty || 0,
          total_stock_value: response.data.total_stock_value || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching stock report:', err);
      setError(err.response?.data?.message || 'Failed to load stock report from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStockReport();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, stockFilter, selectedCategory, selectedManufacturer]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStockFilter('');
    setSelectedCategory('');
    setSelectedManufacturer('');
  };

  const handlePrint = () => {
    window.print();
  };

  const renderRows = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan="10" className="text-center py-6 text-gray-500">Loading stock report...</td>
        </tr>
      );
    }
    if (stockData.length === 0) {
      return (
        <tr>
          <td colSpan="10" className="text-center py-6 text-gray-400">No stock records found.</td>
        </tr>
      );
    }
    return stockData.map((item, index) => {
      const stockQty = Number(item.stock_qty) || 0;
      const purchasePrice = Number(item.purchase_price) || 0;
      const totalVal = (stockQty * purchasePrice).toFixed(2);

      return (
        <tr key={item.product_id || item.id || index} className="hover:bg-gray-50 transition">
          <td className="py-2 px-3 text-center font-semibold text-gray-500">{index + 1}</td>
          <td className="py-2 px-3 font-medium text-gray-800">{item.product_name}</td>
          <td className="py-2 px-3 font-mono text-gray-600">{item.barcode || '---'}</td>
          <td className="py-2 px-3 text-gray-600">{item.pack_size?.pack_size_name || item.pack_size_name || 'Pcs'}</td>
          <td className="py-2 px-3 text-gray-600">{item.category?.category_name || item.category_name || '---'}</td>
          <td className="py-2 px-3 text-gray-600">{item.manufacturer?.manufacturer_name || item.manufacturer_name || '---'}</td>
          <td className="py-2 px-3 text-right">৳{purchasePrice.toFixed(2)}</td>
          <td className="py-2 px-3 text-right">৳{Number(item.sale_price || 0).toFixed(2)}</td>
          <td className="py-2 px-3 text-center">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              stockQty <= 0
                ? 'bg-red-100 text-red-700'
                : stockQty <= 10
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {stockQty}
            </span>
          </td>
          <td className="py-2 px-3 text-right font-bold text-[#417690]">৳{totalVal}</td>
        </tr>
      );
    });
  };

  const reportTable = (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-[#417690] text-white text-[11px] uppercase tracking-wider border-b border-[#345e73]">
          <th className="py-2.5 px-3 text-center w-12">SL</th>
          <th className="py-2.5 px-3">Product Name</th>
          <th className="py-2.5 px-3">Barcode</th>
          <th className="py-2.5 px-3">Pack Size</th>
          <th className="py-2.5 px-3">Category</th>
          <th className="py-2.5 px-3">Manufacturer</th>
          <th className="py-2.5 px-3 text-right">Purchase Price (৳)</th>
          <th className="py-2.5 px-3 text-right">Sale Price (৳)</th>
          <th className="py-2.5 px-3 text-center">Stock Qty</th>
          <th className="py-2.5 px-3 text-right">Total Value (৳)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 text-xs">{renderRows()}</tbody>
      <tfoot>
        <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold text-xs">
          <td colSpan="8" className="py-2.5 px-3 text-right uppercase text-gray-700">Total:</td>
          <td className="py-2.5 px-3 text-center text-emerald-700">{summary.total_stock_qty}</td>
          <td className="py-2.5 px-3 text-right text-[#417690]">৳{Number(summary.total_stock_value).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  );

  const printPortalContent = (
    <div id="print-portal-root" className="hidden print:block bg-white p-4">
      <div className="mb-3 text-center">
        <h2 className="text-base font-bold">Stock Report</h2>
        <p className="text-[10px] text-gray-500">Generated on: {new Date().toLocaleString()}</p>
      </div>
      {reportTable}
    </div>
  );

  return (
    <div className="max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800 print:hidden">

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
          }
          th, td {
            padding: 5px 6px !important;
            font-size: 10px !important;
            border: 1px solid #cbd5e1 !important;
            word-break: break-word;
          }
          th {
            background-color: #417690 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
          }
          tfoot {
            display: table-row-group;
          }
          body > *:not(#print-portal-root) {
            display: none !important;
          }
          #print-portal-root {
            display: block !important;
          }
        }
      `}</style>

      {/* Title Bar */}
      <div className="flex justify-between items-center mb-4 bg-[#417690] text-white px-4 py-2 rounded-lg shadow-sm">
        <h1 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
          📦 Stock Report
        </h1>
        <button
          type="button"
          onClick={handlePrint}
          className="bg-[#345e73] hover:bg-[#284a5b] text-white px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
        >
          🖨️ Print
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-xs sm:text-sm font-semibold">{error}</div>}

      {/* Filter & Live Search Bar */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 mb-4 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <input
            type="text"
            placeholder="Live Search (Name or Barcode)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-72 px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#417690]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#417690] bg-white cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat, idx) => (
              <option key={cat.id || cat.category_id || idx} value={cat.id || cat.category_id}>
                {cat.category_name}
              </option>
            ))}
          </select>

          {/* Manufacturer Filter */}
          <select
            value={selectedManufacturer}
            onChange={(e) => setSelectedManufacturer(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#417690] bg-white cursor-pointer"
          >
            <option value="">All Manufacturers</option>
            {manufacturers.map((man, idx) => (
              <option key={man.id || man.manufacturer_id || idx} value={man.id || man.manufacturer_id}>
                {man.manufacturer_name}
              </option>
            ))}
          </select>

          {/* Stock Status Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#417690] bg-white cursor-pointer"
          >
            <option value="">All Stocks</option>
            <option value="low_stock">Low Stock (≤ 10)</option>
            <option value="out_of_stock">Out of Stock (0)</option>
          </select>

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClearFilters}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer"
          >
            🔄 Clear
          </button>
        </div>
      </div>

      {/* Stock View Container: Desktop Table vs Mobile Cards */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        
        {/* Desktop View (Table) - Hidden on Mobile */}
        <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
          {reportTable}
        </div>

        {/* Mobile View (Card Layout) - Visible only on Mobile */}
        <div className="md:hidden">
          {loading ? (
            <div className="text-center py-6 text-gray-500 text-xs">Loading stock report...</div>
          ) : stockData.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">No stock records found.</div>
          ) : (
            <div className="space-y-3">
              {stockData.map((item, index) => {
                const stockQty = Number(item.stock_qty) || 0;
                const purchasePrice = Number(item.purchase_price) || 0;
                const totalVal = (stockQty * purchasePrice).toFixed(2);

                return (
                  <div key={item.product_id || item.id || index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-xs space-y-2 text-xs">
                    <div className="flex justify-between items-start border-b pb-2">
                      <div>
                        <span className="text-gray-400 font-semibold text-[10px]">#{index + 1}</span>
                        <h3 className="font-bold text-gray-800 text-sm">{item.product_name}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stockQty <= 0
                          ? 'bg-red-100 text-red-700'
                          : stockQty <= 10
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        Qty: {stockQty}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-600 text-[11px]">
                      <div><span className="font-semibold text-gray-500">Barcode:</span> {item.barcode || '---'}</div>
                      <div><span className="font-semibold text-gray-500">Pack Size:</span> {item.pack_size?.pack_size_name || item.pack_size_name || 'Pcs'}</div>
                      <div><span className="font-semibold text-gray-500">Category:</span> {item.category?.category_name || item.category_name || '---'}</div>
                      <div><span className="font-semibold text-gray-500">Manufacturer:</span> {item.manufacturer?.manufacturer_name || item.manufacturer_name || '---'}</div>
                    </div>

                    <div className="border-t pt-2 flex justify-between items-center text-[11px]">
                      <div>
                        <span className="text-gray-500">Buy: ৳{purchasePrice.toFixed(2)}</span> | <span className="text-gray-500">Sale: ৳{Number(item.sale_price || 0).toFixed(2)}</span>
                      </div>
                      <div className="font-bold text-[#417690] text-xs">
                        Total: ৳{totalVal}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Summary Box */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 flex justify-between items-center font-bold text-xs mt-4">
                <span className="text-gray-700 uppercase">Total Summary:</span>
                <div className="text-right">
                  <span className="text-emerald-700 mr-3">Qty: {summary.total_stock_qty}</span>
                  <span className="text-[#417690]">Val: ৳{Number(summary.total_stock_value).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {createPortal(printPortalContent, document.body)}
    </div>
  );
}