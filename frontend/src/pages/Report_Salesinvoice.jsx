import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/material_blue.css';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const toLocalDateString = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Report_Salesinvoice() {
  const [salesInvoiceData, setSalesInvoiceData] = useState([]);
  const [summary, setSummary] = useState({ total_sales_amount: 0, total_due_amount: 0 });

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const fetchSalesInvoiceReport = async () => {
    if (!startDate || !endDate) {
      setSalesInvoiceData([]);
      setSummary({ total_sales_amount: 0, total_due_amount: 0 });
      return;
    }

    if (startDate > endDate) {
      setError('From Date cannot be after To Date.');
      setSalesInvoiceData([]);
      setSummary({ total_sales_amount: 0, total_due_amount: 0 });
      return;
    }

    try {
      setLoading(true);
      setError('');

      let url = `${API_BASE_URL}/reports/sales-invoice?`;
      if (startDate) url += `start_date=${encodeURIComponent(startDate)}&`;
      if (endDate) url += `end_date=${encodeURIComponent(endDate)}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}`;

      const response = await axios.get(url, getAuthHeaders());

      if (response.data && response.data.success) {
        setSalesInvoiceData(response.data.data || []);
        setSummary({
          total_sales_amount: response.data.total_sales_amount || 0,
          total_due_amount: response.data.total_due_amount || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching sales invoice report:', err);
      setError('Failed to load sales invoice report from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSalesInvoiceReport();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, startDate, endDate]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setError('');
    setSalesInvoiceData([]);
    setSummary({ total_sales_amount: 0, total_due_amount: 0 });
  };

  const handlePrint = () => {
    window.print();
  };

  const renderRows = () => {
    if (!startDate || !endDate) {
      return (
        <tr>
          <td colSpan="6" className="text-center py-8 text-amber-600 font-medium bg-amber-50/50">
            ⚠️ Please select both From Date and To Date from the top bar to generate and view the report.
          </td>
        </tr>
      );
    }
    if (loading) {
      return (
        <tr>
          <td colSpan="6" className="text-center py-6 text-gray-500">Loading sales invoice report...</td>
        </tr>
      );
    }
    if (salesInvoiceData.length === 0) {
      return (
        <tr>
          <td colSpan="6" className="text-center py-6 text-gray-400">No sales records found for this date range.</td>
        </tr>
      );
    }
    return salesInvoiceData.map((item, index) => {
      const salesAmt = Number(item.sales_amount) || 0;
      const dueAmt = Number(item.due_amount) || 0;

      return (
        <tr key={item.id || item.invoice_no || index} className="hover:bg-gray-50 transition">
          <td className="py-2.5 px-3 text-center font-semibold text-gray-500">{index + 1}</td>
          <td className="py-2.5 px-3 font-semibold text-[#417690]">{item.invoice_no}</td>
          <td className="py-2.5 px-3 font-medium text-gray-800">{item.customer_name}</td>
          <td className="py-2.5 px-3 font-mono text-gray-600">{item.phone || '---'}</td>
          <td className="py-2.5 px-3 text-right font-bold text-[#417690]">৳{salesAmt.toFixed(2)}</td>
          <td className="py-2.5 px-3 text-right font-bold text-red-600">৳{dueAmt.toFixed(2)}</td>
        </tr>
      );
    });
  };

  const reportTable = (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-[#417690] text-white text-[11px] uppercase tracking-wider border-b border-[#345e73]">
          <th className="py-2.5 px-3 text-center w-12">SL</th>
          <th className="py-2.5 px-3">Invoice No</th>
          <th className="py-2.5 px-3">Customer Name</th>
          <th className="py-2.5 px-3">Phone</th>
          <th className="py-2.5 px-3 text-right">Sales Amount (৳)</th>
          <th className="py-2.5 px-3 text-right">Due Amount (৳)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 text-xs">{renderRows()}</tbody>
      <tfoot>
        <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold text-xs">
          <td colSpan="4" className="py-3 px-3 text-right uppercase text-gray-700">Total Summary:</td>
          <td className="py-3 px-3 text-right text-[#417690]">৳{Number(summary.total_sales_amount).toFixed(2)}</td>
          <td className="py-3 px-3 text-right text-red-600">৳{Number(summary.total_due_amount).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  );

  const printPortalContent = (
    <div id="print-portal-root" className="hidden print:block bg-white p-4">
      <div className="mb-3 text-center">
        <h2 className="text-base font-bold">Sales Invoice & Amount Report</h2>
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
            size: portrait;
            margin: 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 6px 8px !important;
            font-size: 11px !important;
            border: 1px solid #cbd5e1 !important;
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

      {/* Title Bar with Date Pickers */}
      <div className="flex flex-wrap justify-between items-center mb-4 bg-[#417690] text-white px-3 sm:px-4 py-2 rounded-lg shadow-sm gap-2">
        <h1 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
          📊 Sales Invoice & Amount Report
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
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 mb-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <input
              type="text"
              placeholder="Live Search (Invoice No, Customer Name or Phone)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-105 px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#417690]"
            />
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer"
          >
            🔄 Clear Filter
          </button>
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
            <div className="text-center py-6 text-gray-500 text-xs">Loading sales invoice report...</div>
          ) : salesInvoiceData.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">No sales records found for this date range.</div>
          ) : (
            <div className="space-y-3">
              {salesInvoiceData.map((item, index) => {
                const salesAmt = Number(item.sales_amount) || 0;
                const dueAmt = Number(item.due_amount) || 0;

                return (
                  <div key={item.id || item.invoice_no || index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-xs space-y-2 text-xs">
                    <div className="flex justify-between items-start border-b pb-2">
                      <div>
                        <span className="text-gray-400 font-semibold text-[10px]">#{index + 1}</span>
                        <h3 className="font-bold text-[#417690] text-sm">{item.invoice_no}</h3>
                      </div>
                      <span className="text-gray-600 font-mono text-[11px]">{item.phone || '---'}</span>
                    </div>

                    <div className="text-gray-800 font-medium text-xs">
                      <span className="font-semibold text-gray-500">Customer:</span> {item.customer_name}
                    </div>

                    <div className="border-t pt-2 flex justify-between items-center text-[11px]">
                      <div>
                        <span className="text-gray-500">Sales:</span> <span className="font-bold text-[#417690]">৳{salesAmt.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Due:</span> <span className="font-bold text-red-600">৳{dueAmt.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Summary Box */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 flex justify-between items-center font-bold text-xs mt-4">
                <span className="text-gray-700 uppercase">Total Summary:</span>
                <div className="text-right">
                  <span className="text-[#417690] mr-3">Sales: ৳{Number(summary.total_sales_amount).toFixed(2)}</span>
                  <span className="text-red-600">Due: ৳{Number(summary.total_due_amount).toFixed(2)}</span>
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