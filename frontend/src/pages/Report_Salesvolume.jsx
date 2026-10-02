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

export default function Report_Salesvolume() {
  const [summary, setSummary] = useState({ total_sales_amount: 0, total_due_amount: 0 });

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const fetchSalesVolumeReport = async () => {
    if (!startDate || !endDate) {
      setSummary({ total_sales_amount: 0, total_due_amount: 0 });
      return;
    }

    if (startDate > endDate) {
      setError('From Date cannot be after To Date.');
      setSummary({ total_sales_amount: 0, total_due_amount: 0 });
      return;
    }

    try {
      setLoading(true);
      setError('');

      let url = `${API_BASE_URL}/reports/sales-volume?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
      const response = await axios.get(url, getAuthHeaders());

      if (response.data && response.data.success) {
        setSummary({
          total_sales_amount: response.data.total_sales_amount || 0,
          total_due_amount: response.data.total_due_amount || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching sales volume report:', err);
      setError('Failed to load sales volume report from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSalesVolumeReport();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setError('');
    setSummary({ total_sales_amount: 0, total_due_amount: 0 });
  };

  const handlePrint = () => {
    window.print();
  };

  // Printable View Content (Card Style for Print)
  const printPortalContent = (
    <div id="print-portal-root" className="hidden print:block bg-white p-6">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-gray-800">Sales Volume Report</h2>
        <p className="text-xs text-gray-500 mt-1">
          {startDate && endDate ? `Period: ${startDate} to ${endDate} | ` : ''} Generated on: {new Date().toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        <div className="border border-gray-300 p-4 rounded-lg text-center">
          <p className="text-sm font-semibold text-gray-600 uppercase">Total Sales Amount</p>
          <p className="text-2xl font-bold text-[#417690] mt-2">৳{Number(summary.total_sales_amount).toFixed(2)}</p>
        </div>
        <div className="border border-gray-300 p-4 rounded-lg text-center">
          <p className="text-sm font-semibold text-gray-600 uppercase">Total Due Amount</p>
          <p className="text-2xl font-bold text-red-600 mt-2">৳{Number(summary.total_due_amount).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800 print:hidden">
      
      {/* Exact Custom Flatpickr & Print Styles */}
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
          📦 Sales Volume Report
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
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 mb-4 flex justify-end items-center gap-3">
          <button
            type="button"
            onClick={handleClearFilters}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer"
          >
            🔄 Clear Filter
          </button>
        </div>
      )}

      {/* Card Form Display Area */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {!startDate || !endDate ? (
          <div className="text-center py-12 text-amber-600 font-medium bg-amber-50/50 text-sm rounded-lg p-4 border border-amber-200">
            ⚠️ Please select both From Date and To Date from the top bar to generate and view the report cards.
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Loading sales volume report...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto py-4">
            
            {/* Sales Amount Card */}
            <div className="bg-linear-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-6 shadow-sm flex flex-col justify-between transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-[#417690] uppercase">Total Sales Amount</span>
                <span className="text-2xl">💰</span>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#417690]">
                  ৳{Number(summary.total_sales_amount).toFixed(2)}
                </h3>
                <p className="text-[11px] text-gray-500 mt-1">Selected period total sales volume</p>
              </div>
            </div>

            {/* Due Amount Card */}
            <div className="bg-linear-to-br from-red-50 to-white border border-red-200 rounded-xl p-6 shadow-sm flex flex-col justify-between transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-red-600 uppercase">Total Due Amount</span>
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-red-600">
                  ৳{Number(summary.total_due_amount).toFixed(2)}
                </h3>
                <p className="text-[11px] text-gray-500 mt-1">Selected period total due volume</p>
              </div>
            </div>

          </div>
        )}
      </div>

      {createPortal(printPortalContent, document.body)}
    </div>
  );
}