import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../api';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/material_blue.css';

export default function PurchaseDue() {
  const [duePurchases, setDuePurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    prev_page_url: null,
    next_page_url: null,
  });
  const [searchQuery, setSearchQuery] = useState('');

  // পেমেন্ট মডাল স্টেট
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentType, setPaymentType] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  const fetchDuePurchases = async (endpoint = '/purchases/due', customSearch = '', isAll = false) => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      
      if (customSearch !== undefined && customSearch !== '') {
        params.search = customSearch;
      }
      if (isAll) {
        params.all = true;
      }

      // API ইনস্ট্যান্সের মাধ্যমে রিকোয়েস্ট (রেলেটিভ পাথ ব্যবহার করে)
      const cleanEndpoint = endpoint.replace(/^https?:\/\/[^\/]+\/api/, '');
      const response = await API.get(cleanEndpoint, { params });

      if (response.data && response.data.success) {
        const resData = response.data.data;
        setDuePurchases(resData.data || resData);
        setPagination({
          current_page: resData.current_page || 1,
          last_page: resData.last_page || 1,
          prev_page_url: resData.prev_page_url,
          next_page_url: resData.next_page_url,
        });
      }
    } catch (err) {
      console.error('Error fetching due purchases:', err);
      setError('Failed to load the list of due invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuePurchases();
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchDuePurchases('/purchases/due', val);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDuePurchases('/purchases/due', searchQuery);
  };

  const handleClear = () => {
    setSearchQuery('');
    fetchDuePurchases('/purchases/due', '');
  };

  const handleAllDue = () => {
    setSearchQuery('');
    fetchDuePurchases('/purchases/due', '', true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenPayModal = (purchase) => {
    setSelectedPurchase(purchase);
    setPaidAmount('0');
    setPaymentType('Cash');
    setPaymentDate(new Date());
    setPayError('');
    setIsModalOpen(true);
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    if (selectedPurchase) {
      const maxDue = Number(selectedPurchase.due_amount);
      if (Number(val) > maxDue) {
        setPaidAmount(maxDue.toString());
      } else {
        setPaidAmount(val);
      }
    } else {
      setPaidAmount(val);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPurchase) return;

    try {
      setPayLoading(true);
      setPayError('');

      const formattedDate = paymentDate instanceof Date 
        ? paymentDate.toISOString().split('T')[0] 
        : new Date(paymentDate).toISOString().split('T')[0];

      const payload = {
        paid_amount: parseFloat(paidAmount) || 0,
        payment_type: paymentType,
        payment_date: formattedDate,
      };

      const response = await API.post(
        `/purchases/${selectedPurchase.purchase_id}/pay-due`,
        payload
      );

      if (response.data && response.data.success) {
        setSuccessMessage('Payment successfully added!');
        setIsModalOpen(false);
        fetchDuePurchases('/purchases/due', searchQuery);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error submitting payment:', err);
      setPayError(err.response?.data?.message || 'Error submitting the payment.');
    } finally {
      setPayLoading(false);
    }
  };

  const totalPayable = duePurchases.reduce((acc, item) => acc + Number(item.payable_amount || 0), 0);
  const totalPaid = duePurchases.reduce((acc, item) => acc + Number(item.total_paid || 0), 0);
  const totalDue = duePurchases.reduce((acc, item) => acc + Number(item.due_amount || 0), 0);

  const reportTable = (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-[#417690] text-white text-xs uppercase tracking-wider">
          <th className="p-3">SL</th>
          <th className="p-3">POS No</th>
          <th className="p-3">Purchase Date</th>
          <th className="p-3">Supplier Info</th>
          <th className="p-3 text-right">Payable</th>
          <th className="p-3 text-right">Paid</th>
          <th className="p-3 text-right">Due Amount</th>
          <th className="p-3 text-center print:hidden">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 text-sm">
        {loading && duePurchases.length === 0 ? (
          <tr>
            <td colSpan="8" className="text-center py-6 text-gray-400 text-xs">Loading data...</td>
          </tr>
        ) : duePurchases.length > 0 ? (
          duePurchases.map((item, index) => (
            <tr key={item.purchase_id} className="hover:bg-sky-50/20 transition">
              <td className="p-3 text-gray-600 font-semibold">{index + 1}</td>
              <td className="p-3 font-bold text-[#417690]">{item.purchase_pos_no}</td>
              <td className="p-3 text-gray-600">{item.purchase_date}</td>
              <td className="p-3">
                <div className="font-semibold text-gray-800">{item.supplier_name}</div>
                <div className="text-xs text-gray-500">{item.supplier_phone || 'N/A'}</div>
              </td>
              <td className="p-3 text-right font-medium">৳ {Number(item.payable_amount).toFixed(2)}</td>
              <td className="p-3 text-right font-medium text-emerald-600">৳ {Number(item.total_paid).toFixed(2)}</td>
              <td className="p-3 text-right font-black text-rose-600">৳ {Number(item.due_amount).toFixed(2)}</td>
              <td className="p-3 text-center print:hidden">
                <button
                  type="button"
                  onClick={() => handleOpenPayModal(item)}
                  className="bg-[#417690] hover:bg-[#345e73] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Pay Due 💳
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="8" className="text-center py-6 text-gray-400 text-xs">No due invoices found.</td>
          </tr>
        )}
      </tbody>
      {duePurchases.length > 0 && (
        <tfoot>
          <tr className="bg-gray-100 font-bold text-gray-800 text-sm">
            <td colSpan="4" className="p-3 text-right">Total Summary:</td>
            <td className="p-3 text-right text-[#417690]">৳ {totalPayable.toFixed(2)}</td>
            <td className="p-3 text-right text-emerald-600">৳ {totalPaid.toFixed(2)}</td>
            <td className="p-3 text-right text-rose-600">৳ {totalDue.toFixed(2)}</td>
            <td className="print:hidden"></td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  const printPortalContent = (
    <div id="print-portal-root" className="hidden print:block bg-white p-4">
      <div className="mb-4 text-center">
        <h2 className="text-lg font-bold text-gray-800">Purchase Due Report</h2>
        <p className="text-xs text-gray-500">Generated on: {new Date().toLocaleString()}</p>
      </div>
      {reportTable}
    </div>
  );

  return (
    <div className="space-y-2 max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800 print:hidden">

      <div className="bg-[#417690] p-3 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        <h1 className="text-white font-bold text-base md:text-lg flex items-center space-x-2 shrink-0">
          <span>📦</span> <span>Purchase Due Records</span>
        </h1>

        {/* টাইটেল ও সার্চ বারের মাঝখানের স্থান */}
        <div className="w-full md:flex-1 md:px-4 text-center">
          {successMessage && (
            <div className="inline-block px-3 py-1 text-xs text-emerald-900 bg-emerald-100 rounded-lg font-semibold shadow-xs">
              ✅ {successMessage}
            </div>
          )}
          {error && (
            <div className="inline-block px-3 py-1 text-xs text-rose-900 bg-rose-100 rounded-lg font-semibold shadow-xs">
              ❌ {error}
            </div>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex w-full md:w-auto items-center space-x-2 shrink-0">
          <input
            type="text"
            placeholder="Search by Purchase No, Supplier or Phone..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="bg-white px-3 py-1.5 rounded-lg text-sm outline-none w-full md:w-80 border border-gray-300 text-gray-700"
          />
          <button type="submit" className="bg-[#2c4e60] hover:bg-[#203945] text-white px-3.5 py-1.5 rounded-lg text-sm font-bold transition cursor-pointer">
            🔍
          </button>
        </form>
      </div>

      <div className="bg-[#417690] p-2.5 rounded-xl shadow-sm flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleAllDue} className="bg-[#2c4e60] hover:bg-[#203945] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs">
            ➕ All Due
          </button>
          <button type="button" onClick={handleClear} className="bg-[#2c4e60] hover:bg-[#203945] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs">
            🧹 Clear
          </button>
          <button type="button" onClick={handlePrint} className="bg-[#345e73] hover:bg-[#203945] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs">
            🖨️ Print
          </button>
        </div>

        <div className="flex items-center space-x-1 bg-[#2c4e60] p-1 rounded-lg">
          <button type="button" onClick={() => fetchDuePurchases('/purchases/due?page=1', searchQuery)} disabled={pagination.current_page === 1} className="bg-[#417690] hover:bg-[#345e73] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-40 cursor-pointer">
            ⏮ First
          </button>
          <button type="button" onClick={() => pagination.prev_page_url && fetchDuePurchases(pagination.prev_page_url, searchQuery)} disabled={!pagination.prev_page_url} className="bg-[#417690] hover:bg-[#345e73] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-40 cursor-pointer">
            ◀ Prev
          </button>
          <span className="text-white text-xs font-semibold px-2">
            Page {pagination.current_page} of {pagination.last_page}
          </span>
          <button type="button" onClick={() => pagination.next_page_url && fetchDuePurchases(pagination.next_page_url, searchQuery)} disabled={!pagination.next_page_url} className="bg-[#417690] hover:bg-[#345e73] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-40 cursor-pointer">
            Next ▶
          </button>
          <button type="button" onClick={() => fetchDuePurchases(`/purchases/due?page=${pagination.last_page}`, searchQuery)} disabled={pagination.current_page === pagination.last_page} className="bg-[#417690] hover:bg-[#345e73] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-40 cursor-pointer">
            Last ⏭
          </button>
        </div>
      </div>

      <div className="bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          {reportTable}
        </div>

        <div className="md:hidden p-3">
          {loading && duePurchases.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">Loading data...</div>
          ) : duePurchases.length > 0 ? (
            <div className="space-y-3">
              {duePurchases.map((item, index) => (
                <div key={item.purchase_id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs space-y-2 text-xs">
                  <div className="flex justify-between items-start border-b pb-2">
                    <div>
                      <span className="text-gray-400 font-semibold text-[10px]">#{index + 1}</span>
                      <h3 className="font-bold text-[#417690] text-sm">{item.purchase_pos_no}</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                      Due: ৳ {Number(item.due_amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-600 text-[11px]">
                    <div><span className="font-semibold text-gray-500">Date:</span> {item.purchase_date}</div>
                    <div><span className="font-semibold text-gray-500">Supplier:</span> {item.supplier_name}</div>
                    <div><span className="font-semibold text-gray-500">Phone:</span> {item.supplier_phone || 'N/A'}</div>
                    <div><span className="font-semibold text-gray-500">Payable:</span> ৳ {Number(item.payable_amount).toFixed(2)}</div>
                  </div>

                  <div className="border-t pt-2 flex justify-between items-center text-[11px]">
                    <div className="text-emerald-600 font-medium">
                      Paid: ৳ {Number(item.total_paid).toFixed(2)}
                    </div>
                    <button type="button" onClick={() => handleOpenPayModal(item)} className="bg-[#417690] hover:bg-[#345e73] text-white px-3 py-1 rounded text-xs font-bold transition cursor-pointer shadow-xs">
                      Pay Due 💳
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-gray-100 border border-gray-300 rounded-xl p-3 flex flex-col space-y-1 font-bold text-xs mt-4">
                <div className="flex justify-between text-gray-700">
                  <span>Total Payable:</span>
                  <span className="text-[#417690]">৳ {totalPayable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Total Paid:</span>
                  <span className="text-emerald-600">৳ {totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700 border-t pt-1">
                  <span>Total Due:</span>
                  <span className="text-rose-600">৳ {totalDue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-xs">No due invoices found.</div>
          )}
        </div>
      </div>

      {/* পেমেন্ট কালেকশন মডাল */}
      {isModalOpen && selectedPurchase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
            
            <div className="p-5 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-800">
                💰 Pay Due for: {selectedPurchase.purchase_pos_no}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-semibold outline-none cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              {payError && (
                <div className="p-2 text-xs font-semibold bg-rose-50 text-rose-700 rounded border border-rose-200">
                  {payError}
                </div>
              )}

              <div className="bg-sky-50/50 p-3 rounded-lg border border-sky-100 text-xs space-y-1">
                <p><strong className="text-gray-600">Supplier:</strong> {selectedPurchase.supplier_name} ({selectedPurchase.supplier_phone || 'N/A'})</p>
                <p><strong className="text-gray-600">Total Due:</strong> <span className="text-rose-600 font-bold">৳ {Number(selectedPurchase.due_amount).toFixed(2)}</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Payment Amount (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedPurchase.due_amount}
                  value={paidAmount}
                  onChange={handleAmountChange}
                  className="w-full rounded-lg border-gray-300 p-2.5 bg-gray-50 border focus:border-[#417690] focus:bg-white outline-none text-sm font-bold text-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full rounded-lg border-gray-300 p-2.5 bg-gray-50 border focus:border-[#417690] focus:bg-white outline-none text-sm font-medium text-gray-800"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Mobile Banking">Mobile Banking</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Payment Date</label>
                <Flatpickr
                  value={paymentDate}
                  onChange={([date]) => setPaymentDate(date)}
                  options={{ 
                    dateFormat: 'Y-m-d', 
                    altInput: true, 
                    altFormat: 'Y-m-d', 
                    static: false,
                    clickOpens: true 
                  }}
                  className="w-full rounded-lg border-gray-300 p-2.5 bg-gray-50 border focus:border-[#417690] focus:bg-white outline-none text-sm font-medium text-gray-800 cursor-pointer"
                  required
                />
              </div>

              <div className="flex space-x-2 pt-2 border-t border-gray-200 mt-4">
                <button type="submit" disabled={payLoading} className="w-full bg-[#417690] hover:bg-[#345e73] text-white p-2.5 rounded-lg font-bold text-sm shadow-md transition duration-150 cursor-pointer disabled:opacity-50">
                  {payLoading ? 'Processing...' : 'Submit Payment'}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-lg font-semibold text-sm transition duration-150 cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createPortal(printPortalContent, document.body)}

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
            margin: 10mm;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          body > *:not(#print-portal-root) {
            display: none !important;
          }
          #print-portal-root {
            display: block !important;
            width: 100% !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 6px 8px !important;
            font-size: 11px !important;
            border: 1px solid #94a3b8 !important;
            color: #0f172a !important;
          }
          th {
            background-color: #417690 !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tfoot {
            display: table-row-group !important;
          }
        }
      `}</style>
    </div>
  );
}