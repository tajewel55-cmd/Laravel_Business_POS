import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import Adjustment_arrow from './Adjustment_arrow';
import Adjustment_update from './Adjustment_update';
import Adjustment_print from './Adjustment_print';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

// সবসময় একটা নিরাপদ (non-NaN) সংখ্যা রিটার্ন করে
const toSafeNumber = (value, fallback = 0) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

// pack_size ফিল্ডটা API থেকে কখনো string, কখনো পুরো object হতে পারে
const getPackSizeName = (...sources) => {
  for (const source of sources) {
    if (!source) continue;
    if (typeof source === 'string' && source.trim() !== '') return source;
    if (typeof source === 'object' && source.pack_size_name) {
      return String(source.pack_size_name);
    }
  }
  return 'Pcs';
};

export default function Adjustment() {
  const [products, setProducts] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [shopInfo, setShopInfo] = useState({});

  const [currentAdjustmentId, setCurrentAdjustmentId] = useState(null);

  // Stock IN বাড়ায়, Stock OUT কমায় — দুটোর নিয়ম আলাদা
  const [type, setTypeRaw] = useState('IN');

  const [invoiceNo, setInvoiceNo] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [items, setItems] = useState([]);

  const [globalProductSearch, setGlobalProductSearch] = useState('');
  const [showGlobalDropdown, setShowGlobalDropdown] = useState(false);

  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const dateInputRef = useRef(null);
  const globalSearchRef = useRef(null);
  const invoiceSearchRef = useRef(null);
  const flatpickrInstanceRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const handlePrintAction = () => {
    window.print();
  };

  // পরবর্তী adj_invoice_no প্রিভিউ হিসেব করা — টাইপ (IN/OUT) অনুযায়ী আলাদা সিকোয়েন্স
  const computeNextInvoiceNo = (adjustmentList, forType) => {
    const list = Array.isArray(adjustmentList) ? adjustmentList : [];
    const sameType = list.filter((a) => String(a.type).toUpperCase() === forType);
    if (sameType.length === 0) {
      return `ADJ-${forType}-000001`;
    }
    const sorted = [...sameType].sort((a, b) => (b.adjustment_id || b.id || 0) - (a.adjustment_id || a.id || 0));
    const last = sorted[0];
    let nextSeq = 1;
    if (last && last.adj_invoice_no) {
      const matches = String(last.adj_invoice_no).match(/(\d+)$/);
      if (matches && matches[1]) {
        nextSeq = parseInt(matches[1], 10) + 1;
      }
    }
    return `ADJ-${forType}-${String(nextSeq).padStart(6, '0')}`;
  };

  // টাইপ বদলালে (নতুন এন্ট্রির সময়) ইনভয়েস নাম্বার প্রিভিউ ও আইটেম লিস্ট রিসেট করা হয় —
  // কারণ IN/OUT-এ স্টক-সীমাবদ্ধতার নিয়ম আলাদা, তাই আইটেম মিশিয়ে ফেলা ঠিক হবে না
  const setType = (newType) => {
    setTypeRaw(newType);
    if (!currentAdjustmentId) {
      setItems([]);
      setInvoiceNo(computeNextInvoiceNo(adjustments, newType));
      setError('');
    }
  };

  const handleNewAdd = (adjustmentList, forType) => {
    const useType = forType || type || 'IN';
    setCurrentAdjustmentId(null);
    setItems([]);
    setTypeRaw(useType);
    setRemarks('');
    setInvoiceSearchQuery('');
    setAdjustmentDate(new Date().toISOString().split('T')[0]);
    setError('');

    const listToProcess = Array.isArray(adjustmentList) ? adjustmentList : (Array.isArray(adjustments) ? adjustments : []);
    setInvoiceNo(computeNextInvoiceNo(listToProcess, useType));
    setSuccess('Ready for New Adjustment Entry');
  };

  const handleClearForm = () => {
    handleNewAdd(adjustments, type);
  };

  const loadAdjustmentRecord = (a, { silent = false } = {}) => {
    if (!a) return;
    const aId = a.adjustment_id || a.id;
    setCurrentAdjustmentId(aId);
    const invNo = a.adj_invoice_no || a.invoice_no;

    if (silent) {
      setInvoiceSearchQuery('');
    } else {
      setInvoiceSearchQuery(invNo || '');
    }
    setInvoiceNo(invNo || '');
    setTypeRaw(String(a.type || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN');
    setAdjustmentDate(a.adjustment_date || new Date().toISOString().split('T')[0]);
    setRemarks(a.remarks || '');

    const rawItems = a.adjustment_details || a.details || a.items || [];
    if (Array.isArray(rawItems)) {
      const loadedItems = rawItems.map((i) => {
        const qty = toSafeNumber(i?.quantity);
        const price = toSafeNumber(i?.purchase_price);
        const prodInfo = i?.product || {};
        const currentStock = toSafeNumber(
          prodInfo.stock_qty ?? prodInfo.current_stock ?? prodInfo.stock,
          9999
        );
        return {
          product_id: i?.product_id,
          product_name: prodInfo.product_name || i?.product_name || 'Product',
          barcode: prodInfo.barcode || i?.barcode || '---',
          pack_size: getPackSizeName(prodInfo.pack_size_name, prodInfo.packSize, prodInfo.pack_size, i?.pack_size),
          quantity: qty,
          purchase_price: price,
          subtotal: (qty * price).toFixed(2),
          // OUT টাইপের এডিট করার সময় — এই আইটেমটার আগের কোয়ান্টিটি ইতিমধ্যে স্টক থেকে বিয়োগ হয়ে আছে,
          // তাই এডিট-টাইম ম্যাক্স হিসেব করার সময় সেটা ফেরত যোগ করে দেখানো হচ্ছে
          stock: currentStock + qty,
        };
      });
      setItems(loadedItems);
    } else {
      setItems([]);
    }

    if (silent) {
      setSuccess('');
      setError('');
    } else {
      setSuccess(`Loaded Adjustment: ${invNo}`);
    }
  };

  const showLatestOrNew = (adjustmentList) => {
    if (Array.isArray(adjustmentList) && adjustmentList.length > 0) {
      const sorted = [...adjustmentList].sort((a, b) => (b.adjustment_id || b.id || 0) - (a.adjustment_id || a.id || 0));
      loadAdjustmentRecord(sorted[0]);
    } else {
      handleNewAdd(adjustmentList, 'IN');
    }
  };

  const fetchData = async () => {
    try {
      const [prodRes, adjRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/products`, getAuthHeaders()).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_BASE_URL}/adjustments`, getAuthHeaders()).catch(() => ({ data: { data: [] } })),
      ]);

      const productData = prodRes.data.data || prodRes.data || [];
      const adjustmentData = adjRes.data.data || adjRes.data || [];

      setProducts(Array.isArray(productData) ? productData : []);
      setAdjustments(Array.isArray(adjustmentData) ? adjustmentData : []);

      return Array.isArray(adjustmentData) ? adjustmentData : [];
    } catch (err) {
      console.error('Error fetching data', err);
      setError('Failed to load data from server.');
      return [];
    }
  };

  const fetchShopInfo = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/company-profile`, getAuthHeaders());
      const raw = res.data?.data ?? res.data;
      const profile = Array.isArray(raw) ? raw[0] : raw;
      if (profile && typeof profile === 'object') {
        setShopInfo(profile);
      }
    } catch (err) {
      console.error('Failed to load company profile:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchData().then((adjustmentData) => {
      if (!cancelled) showLatestOrNew(adjustmentData);
    });
    fetchShopInfo();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (globalSearchRef.current && !globalSearchRef.current.contains(event.target)) {
        setShowGlobalDropdown(false);
      }
      if (invoiceSearchRef.current && !invoiceSearchRef.current.contains(event.target)) {
        setShowInvoiceDropdown(false);
      }
      const clickedInsideDateInput = dateInputRef.current && dateInputRef.current.contains(event.target);
      const clickedInsideCalendar = event.target.closest && event.target.closest('.flatpickr-calendar');
      if (!clickedInsideDateInput && !clickedInsideCalendar && flatpickrInstanceRef.current) {
        flatpickrInstanceRef.current.close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (dateInputRef.current && !flatpickrInstanceRef.current) {
      flatpickrInstanceRef.current = flatpickr(dateInputRef.current, {
        dateFormat: 'Y-m-d',
        defaultDate: adjustmentDate,
        allowInput: true,
        clickOpens: true,
        closeOnSelect: true,
        disableMobile: true,
        onChange: (selectedDates, dateStr) => {
          if (dateStr) setAdjustmentDate(dateStr);
        },
      });
    }
    return () => {
      if (flatpickrInstanceRef.current) {
        flatpickrInstanceRef.current.destroy();
        flatpickrInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flatpickrInstanceRef.current) {
      flatpickrInstanceRef.current.setDate(adjustmentDate, false);
    }
  }, [adjustmentDate]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleFirstRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    const sorted = [...adjustments].sort((a, b) => (a.adjustment_id || a.id || 0) - (b.adjustment_id || b.id || 0));
    loadAdjustmentRecord(sorted[0], { silent: true });
  };

  const handlePrevRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    const sorted = [...adjustments].sort((a, b) => (a.adjustment_id || a.id || 0) - (b.adjustment_id || b.id || 0));
    let currentIndex = sorted.findIndex((a) => (a.adjustment_id || a.id) === currentAdjustmentId);
    loadAdjustmentRecord(currentIndex <= 0 ? sorted[0] : sorted[currentIndex - 1], { silent: true });
  };

  const handleNextRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    const sorted = [...adjustments].sort((a, b) => (a.adjustment_id || a.id || 0) - (b.adjustment_id || b.id || 0));
    let currentIndex = sorted.findIndex((a) => (a.adjustment_id || a.id) === currentAdjustmentId);
    loadAdjustmentRecord(currentIndex === -1 || currentIndex >= sorted.length - 1 ? sorted[sorted.length - 1] : sorted[currentIndex + 1], { silent: true });
  };

  const handleLastRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    const sorted = [...adjustments].sort((a, b) => (a.adjustment_id || a.id || 0) - (b.adjustment_id || b.id || 0));
    loadAdjustmentRecord(sorted[sorted.length - 1], { silent: true });
  };

  // OUT টাইপে বর্তমান স্টকের বেশি নেওয়া যাবে না, IN টাইপে কোনো সীমা নেই
  const addProductToTable = (product) => {
    if (!product || typeof product !== 'object') {
      setError('An invalid product has been selected.');
      return;
    }

    const productId = product.product_id ?? product.id;
    if (productId === undefined || productId === null) {
      setError('The product ID was not found, so it could not be added.');
      return;
    }

    const currentStock = toSafeNumber(
      product.stock_qty ?? product.current_stock ?? product.stock,
      9999
    );

    const productDisplayName = String(product.product_name || product.name || 'Product');

    if (type === 'OUT' && currentStock <= 0) {
      setError(`Product "${productDisplayName}" has no stock to take out!`);
      return;
    }

    setItems((prevItems) => {
      const safePrevItems = Array.isArray(prevItems) ? prevItems : [];
      const existingIndex = safePrevItems.findIndex((item) => item.product_id === productId);
      const packSizeText = getPackSizeName(product.pack_size_name, product.packSize, product.pack_size);

      if (existingIndex > -1) {
        const nextQty = toSafeNumber(safePrevItems[existingIndex].quantity) + 1;

        if (type === 'OUT' && nextQty > currentStock) {
          setError(`Cannot add more. Available stock is only ${currentStock}`);
          return safePrevItems;
        }

        const price = toSafeNumber(safePrevItems[existingIndex].purchase_price);
        const newItems = [...safePrevItems];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: nextQty,
          subtotal: (nextQty * price).toFixed(2),
        };
        return newItems;
      }

      const price = Math.max(0, toSafeNumber(product.purchase_price ?? product.sale_price ?? product.price, 0));
      const newItem = {
        product_id: productId,
        product_name: productDisplayName,
        barcode: String(product.barcode || product.product_code || '---'),
        pack_size: packSizeText,
        quantity: 1,
        purchase_price: price,
        subtotal: price.toFixed(2),
        stock: currentStock,
      };
      return [...safePrevItems, newItem];
    });

    setGlobalProductSearch('');
    setShowGlobalDropdown(false);
    setError('');
  };

  const handleItemChange = (index, field, value) => {
    setItems((prevItems) => {
      if (!Array.isArray(prevItems) || !prevItems[index]) return prevItems;

      const newItems = [...prevItems];
      let val = parseFloat(value);

        if (field === 'quantity') {
        val = Math.floor(val);

        if (!Number.isFinite(val) || val < 1) {
            val = 1;
        }

        if (type === 'OUT') {
            const stock = toSafeNumber(newItems[index].stock, 9999);

            if (val > stock) {
            setError(`Quantity exceeds available stock (${stock})!`);
            val = Math.floor(stock) > 0 ? Math.floor(stock) : 1;
            } else {
            setError('');
            }
        }

        newItems[index] = {
            ...newItems[index],
            quantity: val,
        };
        } else if (field === 'purchase_price') {
        if (isNaN(val) || val < 0) val = 0;
        newItems[index] = { ...newItems[index], purchase_price: val };
      }

      const qty = toSafeNumber(newItems[index].quantity);
      const price = toSafeNumber(newItems[index].purchase_price);
      newItems[index] = { ...newItems[index], subtotal: (qty * price).toFixed(2) };
      return newItems;
    });
  };

  const removeRow = (index) => {
    setItems((prevItems) => (Array.isArray(prevItems) ? prevItems.filter((_, i) => i !== index) : []));
  };

  const totalQty = items.reduce((sum, item) => sum + toSafeNumber(item.quantity), 0);
  const totalValue = items.reduce((sum, item) => sum + toSafeNumber(item.subtotal), 0);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (items.length === 0) {
      setError('Please add at least one product to the adjustment list!');
      return false;
    }

    if (currentAdjustmentId) {
      const isConfirmed = window.confirm('Are you sure you want to update this adjustment record?');
      if (!isConfirmed) {
        return false;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      type,
      adjustment_date: adjustmentDate,
      remarks: remarks || '',
      items: items.map((i) => ({
        product_id: parseInt(i.product_id, 10),
        quantity: Math.max(1, Math.floor(toSafeNumber(i.quantity, 1))),
        purchase_price: Math.max(0, toSafeNumber(i.purchase_price)),
      })),
    };

    try {
      let savedAdjustment;
      if (currentAdjustmentId) {
        const res = await axios.put(`${API_BASE_URL}/adjustments/${currentAdjustmentId}`, payload, getAuthHeaders());
        savedAdjustment = res.data.data;
        setSuccess('Adjustment updated successfully!');
      } else {
        const res = await axios.post(`${API_BASE_URL}/adjustments`, payload, getAuthHeaders());
        savedAdjustment = res.data.data;
        setSuccess('Adjustment recorded successfully!');
      }

      const updatedAdjustments = await fetchData();
      if (savedAdjustment) {
        loadAdjustmentRecord(savedAdjustment);
      } else {
        showLatestOrNew(updatedAdjustments);
      }

      return true;
    } catch (err) {
      const validationErrors = err.response?.data?.errors;
      let errorMessage = err.response?.data?.message || err.response?.data?.error;
      if (validationErrors) {
        errorMessage = Object.values(validationErrors).flat().join(' ');
      }
      setError(errorMessage || 'Failed to save adjustment!');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndPrint = async (e) => {
    const ok = await handleSubmit(e);
    if (ok) handlePrintAction();
  };

  const handleDelete = async () => {
    if (!currentAdjustmentId) {
      setError('Please select an existing adjustment record to delete.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this adjustment record? Stock changes will be reversed.')) return;

    try {
      setLoading(true);
      setError('');
      await axios.delete(`${API_BASE_URL}/adjustments/${currentAdjustmentId}`, getAuthHeaders());
      setSuccess('Adjustment deleted successfully!');
      const updatedAdjustments = await fetchData();
      showLatestOrNew(updatedAdjustments);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete adjustment record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800">

      <Adjustment_print
        adjustmentData={{
          adj_invoice_no: invoiceNo,
          adjustment_date: adjustmentDate,
          type,
          remarks,
          details: items,
        }}
        shopInfo={shopInfo}
      />

      {/* প্রিন্টের সময় শুধু উপরের Adjustment_print (রিসিট) দেখাবে — বাকি পুরো ফর্ম UI প্রিন্টে লুকিয়ে যাবে */}
      <div className="print:hidden">

      <div className="grid grid-cols-1 md:grid-cols-3 items-center mb-3 bg-[#417690] text-white px-3 py-1.5 rounded-lg shadow-sm gap-3">
        <div className="flex items-center">
          <h1 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap">
            🔄 Stock Adjustment Form
          </h1>
        </div>

        <div className="flex justify-center items-center px-2">
          {success ? (
            <div className="w-full max-w-xs py-0.5 px-2 bg-emerald-500 text-white rounded text-[11px] font-semibold text-center truncate shadow-sm animate-pulse">
              {success}
            </div>
          ) : (
            <div className="h-5"></div>
          )}
        </div>

        <div className="relative" ref={invoiceSearchRef}>
          <div className="flex items-center bg-white rounded overflow-hidden border border-gray-300 shadow-xs">
            <input
              type="text"
              placeholder="Search by Adj. No..."
              value={invoiceSearchQuery}
              onChange={(e) => {
                setInvoiceSearchQuery(e.target.value);
                setShowInvoiceDropdown(true);
              }}
              onFocus={() => setShowInvoiceDropdown(true)}
              className="w-full px-2.5 py-1 text-xs text-gray-800 bg-white focus:outline-none font-mono"
            />
            <button type="button" className="bg-[#417690] hover:bg-[#345e73] text-white px-2.5 py-1 flex items-center justify-center">
              🔍
            </button>
          </div>

          {showInvoiceDropdown && invoiceSearchQuery.trim() !== '' && (
            <ul className="absolute z-40 left-0 w-full bg-white text-gray-800 border border-gray-300 rounded-md top-full mt-1 max-h-48 overflow-y-auto shadow-lg">
              {adjustments.filter((a) =>
                String(a.adj_invoice_no || a.invoice_no || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase())
              ).length === 0 ? (
                <li className="px-3 py-2 text-xs text-gray-400">No adjustment found</li>
              ) : (
                adjustments
                  .filter((a) =>
                    String(a.adj_invoice_no || a.invoice_no || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase())
                  )
                  .map((a) => {
                    const invNo = a.adj_invoice_no || a.invoice_no;
                    const aType = String(a.type || '').toUpperCase();
                    return (
                      <li
                        key={a.adjustment_id || a.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          loadAdjustmentRecord(a);
                          setShowInvoiceDropdown(false);
                        }}
                        className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 flex justify-between items-center"
                      >
                        <span className="font-mono font-bold text-[#417690]">{invNo}</span>
                        <span className={`text-[11px] font-bold ${aType === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>{aType}</span>
                      </li>
                    );
                  })
              )}
            </ul>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-xs sm:text-sm font-semibold">{error}</div>}

      <form id="adjustment-form" onSubmit={handleSubmit}>
        <Adjustment_update
          type={type}
          setType={setType}
          invoiceNo={invoiceNo}
          dateInputRef={dateInputRef}
          adjustmentDate={adjustmentDate}
          setAdjustmentDate={setAdjustmentDate}
          remarks={remarks}
          setRemarks={setRemarks}
          globalSearchRef={globalSearchRef}
          globalProductSearch={globalProductSearch}
          setGlobalProductSearch={setGlobalProductSearch}
          showGlobalDropdown={showGlobalDropdown}
          setShowGlobalDropdown={setShowGlobalDropdown}
          products={products}
          addProductToTable={addProductToTable}
          totalQty={totalQty}
          totalValue={totalValue}
        />

        <div className="mt-4 bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-wrap justify-between items-center mb-3 gap-2 bg-[#417690] p-2 rounded-md">

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleNewAdd(adjustments, 'IN')}
                disabled={loading}
                className="bg-[#345e73] hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>➕</span> New
              </button>

              <button
                type="submit"
                disabled={loading}
                className="bg-[#345e73] hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>💾</span> {currentAdjustmentId ? 'Update Button' : 'Save Button'}
              </button>

              <button
                type="button"
                onClick={handleSaveAndPrint}
                disabled={loading}
                className="bg-[#345e73] hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>🖨️</span> Save & Print
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={!currentAdjustmentId || loading}
                className="bg-[#345e73] hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>🗑️</span> Delete
              </button>

              <button
                type="button"
                onClick={handlePrintAction}
                disabled={loading}
                className="bg-[#345e73] hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>🖨️</span> Print
              </button>

              <button
                type="button"
                onClick={handleClearForm}
                disabled={loading}
                className="bg-[#345e73] hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>🧹</span> Clear
              </button>
            </div>

            <Adjustment_arrow
              onFirst={handleFirstRecord}
              onPrev={handlePrevRecord}
              onNext={handleNextRecord}
              onLast={handleLastRecord}
              disabled={loading}
            />
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#417690] text-white text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-3 text-center w-12 rounded-tl-lg">SL</th>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Barcode</th>
                  <th className="py-2 px-3">Pack Size</th>
                  <th className="py-2 px-3 text-center w-24">Qty</th>
                  <th className="py-2 px-3 text-right w-28">Unit Price (৳)</th>
                  <th className="py-2 px-3 text-right w-28">Subtotal (৳)</th>
                  <th className="py-2 px-3 text-center w-16 rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6 text-gray-400">
                      No products added yet. Use the search box above to add products.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.product_id ?? index} className="hover:bg-gray-50 transition">
                      <td className="py-2 px-3 text-center font-semibold text-gray-500">{index + 1}</td>
                      <td className="py-2 px-3 font-medium text-gray-800">{item.product_name}</td>
                      <td className="py-2 px-3 font-mono text-gray-600">{item.barcode}</td>
                      <td className="py-2 px-3 text-gray-600">{item.pack_size}</td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs font-semibold"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.purchase_price}
                          onChange={(e) => handleItemChange(index, 'purchase_price', e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-xs font-semibold"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#417690]">
                        ৳{item.subtotal}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-red-500 hover:text-red-700 font-bold p-1 rounded"
                          title="Remove Item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}