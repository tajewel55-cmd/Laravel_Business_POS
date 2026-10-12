import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/material_blue.css';
import API from '../api';

const toLocalDateString = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Report_Profitqty() {
  const [profitQtyData, setProfitQtyData] = useState([]);
  const [summary, setSummary] = useState({ total_products: 0, total_sales_qty: 0, total_profit_value: 0 });

  // Dropdown lists for filters
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [catRes, manRes] = await Promise.all([
          API.get('/categories').catch(() => ({ data: { data: [] } })),
          API.get('/manufacturers').catch(() => ({ data: { data: [] } })),
        ]);

        const catData = catRes.data?.data || catRes.data || [];
        const manData = manRes.data?.data || manRes.data || [];

        setCategories(Array.isArray(catData) ? catData : []);
        setManufacturers(Array.isArray(manData) ? manData : []);
      } catch (err) {
        console.error('Error loading filter options', err);
      }
    };
    fetchFilterOptions();
  }, []);

  const fetchProfitQtyReport = async () => {
    if (!startDate || !endDate) {
      setProfitQtyData([]);
      setSummary({ total_products: 0, total_sales_qty: 0, total_profit_value: 0 });
      return;
    }

    if (startDate > endDate) {
      setError('From Date cannot be after To Date.');
      setProfitQtyData([]);
      setSummary({ total_products: 0, total_sales_qty: 0, total_profit_value: 0 });
      return;
    }

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedManufacturer) params.append('manufacturer_id', selectedManufacturer);

      const response = await API.get(`/reports/profit-qty?${params.toString()}`);

      if (response.data && response.data.success) {
        const responseData = response.data.data || [];
        setProfitQtyData(Array.isArray(responseData) ? responseData : []);
        setSummary({
          total_products: response.data.total_products || 0,
          total_sales_qty: response.data.total_sales_qty || 0,
          total_profit_value: response.data.total_profit_value || 0,
        });
      } else {
        setProfitQtyData([]);
        setSummary({ total_products: 0, total_sales_qty: 0, total_profit_value: 0 });
      }
    } catch (err) {
      console.error('Error fetching profit qty report:', err);
      setError(err.response?.data?.message || 'Failed to load profit quantity report from server.');
      setProfitQtyData([]);
      setSummary({ total_products: 0, total_sales_qty: 0, total_profit_value: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProfitQtyReport();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory, selectedManufacturer, startDate, endDate]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedManufacturer('');
    setStartDate('');
    setEndDate('');
    setError('');
    setProfitQtyData([]);
    setSummary({ total_products: 0, total_sales_qty: 0, total_profit_value: 0 });
  };

  const handlePrint = () => {
    window.print();
  };

  const renderRows = () => {
    if (!startDate || !endDate) {
      return (
        <tr>
          <td colSpan="9" className="text-center py-8 text-amber-600 font-medium bg-amber-50/50">
            ⚠️ Please select both From Date and To Date from the top bar to generate and view the report.
          </td>
        </tr>
      );
    }
    if (loading) {
      return (
        <tr>
          <td colSpan="9" className="text-center py-6 text-gray-500">Loading profit quantity report...</td>
        </tr>
      );
    }
    if (profitQtyData.length === 0) {
      return (
        <tr>
          <td colSpan="9" className="text-center py-6 text-gray-400">No active sales/profit records found for this date range.</td>
        </tr>
      );
    }
    return profitQtyData.map((item, index) => {
      const salesQty = Number(item.sales_qty) || 0;
      const salePrice = Number(item.sale_price) || 0;
      const profitVal = Number(item.profit_value) || 0;

      return (
        <tr key={item.id || item.product_id || index} className="hover:bg-gray-50 transition">
          <td className="py-2 px-3 text-center font-semibold text-gray-500">{index + 1}</td>
          <td className="py-2 px-3 font-medium text-gray-800">{item.product_name}</td>
          <td className="py-2 px-3 font-mono text-gray-600">{item.barcode || '---'}</td>
          <td className="py-2 px-3 text-gray-600">{item.pack_size?.pack_size_name || item.pack_size_name || 'Pcs'}</td>
          <td className="py-2 px-3 text-gray-600">{item.category?.category_name || item.category_name || '---'}</td>
          <td className="py-2 px-3 text-gray-600">{item.manufacturer?.manufacturer_name || item.manufacturer_name || '---'}</td>
          <td className="py-2 px-3 text-right">৳{salePrice.toFixed(2)}</td>
          <td className="py-2 px-3 text-center font-bold text-emerald-700">{salesQty}</td>
          <td className={`py-2 px-3 text-right font-bold ${profitVal >= 0 ? 'text-[#417690]' : 'text-red-600'}`}>
            ৳{profitVal.toFixed(2)}
          </td>
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
          <th className="py-2.5 px-3 text-right">Sale Price (৳)</th>
          <th className="py-2.5 px-3 text-center">Sales Qty</th>
          <th className="py-2.5 px-3 text-right">Total Value (৳)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 text-xs">{renderRows()}</tbody>
      <tfoot>
        <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold text-xs">
          <td colSpan="7" className="py-2.5 px-3 text-right uppercase text-gray-700">Total:</td>
          <td className="py-2.5 px-3 text-center text-emerald-700">{summary.total_sales_qty}</td>
          <td className="py-2.5 px-3 text-right text-[#417690]">৳{Number(summary.total_profit_value).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  );

  const printPortalContent = (
    <div id="print-portal-root" className="hidden print:block bg-white p-4">
      <div className="mb-3 text-center">
        <h2 className="text-base font-bold">Profit & Sales Quantity Report</h2>
        <p className="text-[10px] text-gray-500">
          {startDate && endDate ? `Period: ${startDate} to ${endDate} | ` : ''} Generated on: {new Date().toLocaleString()}
        </p>
      </div>
      {reportTable}
    </div>
  );

  return (
    <div className="max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800 print:hidden">

      <style>{`
        .flatpickr-calendar {
          border: 1px solid #417690 !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          z-index: 99999 !important;
        }
        .flatpickr-calendar .flatpickr-months,
        .flatpickr-calendar .flatpickr-months .flatpickr-month,
        .flatpickr-calendar span.flatpickr-weekday,
        .flatpickr-weekdays {
          background: #417690 !important;
          color: white !important;
          fill: white !important;
        }
        .flatpickr-current-month,
        .flatpickr-current-month select.flatpickr-monthDropdown-months,
        .flatpickr-current-month input.cur-year {
          background: #417690 !important;
          color: white !important;
        }
        .flatpickr-current-month select.flatpickr-monthDropdown-months option {
          background: #417690 !important;
          color: white !important;
        }
        .flatpickr-months .flatpickr-prev-month, 
        .flatpickr-months .flatpickr-next-month {
          fill: white !important;
        }
        .flatpickr-day.selected, 
        .flatpickr-day.selected:hover,
        .flatpickr-day.today,
        .flatpickr-day.today:hover {
          background: #417690 !important;
          border-color: #417690 !important;
          color: #fff !important;
        }

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

      {/* Title Bar with Integrated Flatpickr Date Selectors */}
      <div className="flex flex-wrap justify-between items-center mb-4 bg-[#417690] text-white px-3 sm:px-4 py-2 rounded-lg shadow-sm gap-2">
        <h1 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
          💰 Profit Quantity Report
        </h1>

        <div className="flex flex-row flex-nowrap items-center gap-2 sm:gap-3 text-white overflow-x-auto">
          <div className="flex flex-row flex-nowrap items-center gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap">From:</span>
            <Flatpickr
              options={{ 
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'Y-m-d',
                clickOpens: true
              }}
              value={startDate}
              onChange={([date]) => setStartDate(toLocalDateString(date))}
              placeholder="Select Date"
              className="w-24 sm:w-28 px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs bg-white text-gray-800 rounded border border-gray-300 focus:outline-none cursor-pointer font-medium"
            />
          </div>

          <div className="flex flex-row flex-nowrap items-center gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap">To:</span>
            <Flatpickr
              options={{ 
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'Y-m-d',
                clickOpens: true
              }}
              value={endDate}
              onChange={([date]) => setEndDate(toLocalDateString(date))}
              placeholder="Select Date"
              className="w-24 sm:w-28 px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs bg-white text-gray-800 rounded border border-gray-300 focus:outline-none cursor-pointer font-medium"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="bg-[#345e73] hover:bg-[#284a5b] text-white px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
        >
          🖨️ Print
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-xs sm:text-sm font-semibold">{error}</div>}

      {startDate && endDate && (
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 mb-4 flex flex-wrap justify-between items-center gap-3 transition-all duration-300">
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
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#417690] bg-white cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id || cat.category_id} value={cat.id || cat.category_id}>
                  {cat.category_name}
                </option>
              ))}
            </select>

            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#417690] bg-white cursor-pointer"
            >
              <option value="">All Manufacturers</option>
              {manufacturers.map((man) => (
                <option key={man.id || man.manufacturer_id} value={man.id || man.manufacturer_id}>
                  {man.manufacturer_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleClearFilters}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer"
            >
              🔄 Clear
            </button>
          </div>
        </div>
      )}

      {/* Responsive Container: Desktop Table vs Mobile Cards */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        
        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
          {reportTable}
        </div>

        {/* Mobile View (Card Layout) */}
        <div className="md:hidden">
          {!startDate || !endDate ? (
            <div className="text-center py-8 text-amber-600 font-medium bg-amber-50/50 text-xs rounded-lg p-3">
              ⚠️ Please select both From Date and To Date from the top bar to generate and view the report.
            </div>
          ) : loading ? (
            <div className="text-center py-6 text-gray-500 text-xs">Loading profit quantity report...</div>
          ) : profitQtyData.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">No active sales/profit records found for this date range.</div>
          ) : (
            <div className="space-y-3">
              {profitQtyData.map((item, index) => {
                const salesQty = Number(item.sales_qty) || 0;
                const salePrice = Number(item.sale_price) || 0;
                const profitVal = Number(item.profit_value) || 0;

                return (
                  <div key={item.id || item.product_id || index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-xs space-y-2 text-xs">
                    <div className="flex justify-between items-start border-b pb-2">
                      <div>
                        <span className="text-gray-400 font-semibold text-[10px]">#{index + 1}</span>
                        <h3 className="font-bold text-gray-800 text-sm">{item.product_name}</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        Sales Qty: {salesQty}
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
                        <span className="text-gray-500">Sale Price: ৳{salePrice.toFixed(2)}</span>
                      </div>
                      <div className={`font-bold text-xs ${profitVal >= 0 ? 'text-[#417690]' : 'text-red-600'}`}>
                        Total Value: ৳{profitVal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Summary Box */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 flex justify-between items-center font-bold text-xs mt-4">
                <span className="text-gray-700 uppercase">Total Summary:</span>
                <div className="text-right">
                  <span className="text-emerald-700 mr-3">Qty: {summary.total_sales_qty}</span>
                  <span className="text-[#417690]">Total Value: ৳{Number(summary.total_profit_value).toFixed(2)}</span>
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