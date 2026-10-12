import { useState, useEffect, useRef } from 'react';
import API from '../api';
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import Adjustment_arrow from './Adjustment_arrow';
import Adjustment_update from './Adjustment_update';
import Adjustment_print from './Adjustment_print';

// ---------- Limits (must match backend validation) ----------
const MAX_QTY = 1000000;
const MAX_PRICE = 100000000;
const MAX_REMARKS_LENGTH = 1000;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Always returns a safe (non-NaN) number
const toSafeNumber = (value, fallback = 0) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

// Rounds to 2 decimals (avoids floating-point drift)
const round2 = (n) => Math.round((toSafeNumber(n, 0) + Number.EPSILON) * 100) / 100;

const calcSubtotal = (qty, price) => round2(qty * price).toFixed(2);

// Local date (YYYY-MM-DD) — toISOString() would give the UTC date, which is wrong for BD timezone
const getToday = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Stock as a whole number, or null when unknown (unknown = don't block on the frontend, backend decides)
const parseStock = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
};

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

const getRecordId = (a) => String(a?.adjustment_id ?? a?.id ?? '');

// Next invoice number for a type = (highest existing sequence of that type) + 1
const computeNextInvoiceNo = (adjustmentList, forType) => {
  let max = 0;
  (Array.isArray(adjustmentList) ? adjustmentList : [])
    .filter((a) => String(a?.type).toUpperCase() === forType)
    .forEach((a) => {
      const m = String(a?.adj_invoice_no || a?.invoice_no || '').match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    });
  return `ADJ-${forType}-${String(max + 1).padStart(6, '0')}`;
};

export default function Adjustment() {
  const [products, setProducts] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [shopInfo, setShopInfo] = useState({});

  const [currentAdjustmentId, setCurrentAdjustmentId] = useState(null);
  const [type, setTypeRaw] = useState('IN');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState(getToday());
  const [remarks, setRemarks] = useState('');

  const [items, setItems] = useState([]);

  // product_id -> signed stock effect of the SAVED record (IN = +qty, OUT = -qty).
  // Used so the frontend limits match the backend's net-delta stock check.
  const [originalEffects, setOriginalEffects] = useState({});

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

  const handlePrintAction = () => {
    window.print();
  };

  // ---------- Quantity limits ----------
  // final stock = stock + newEffect - oldEffect must stay >= 0
  //   IN : qty >= oldEffect - stock
  //   OUT: qty <= stock - oldEffect
  const getBounds = (item, forType) => {
    const stock = item?.stock;
    if (stock === null || stock === undefined) return { min: 1, max: MAX_QTY };
    const old = originalEffects[String(item.product_id)] ?? 0;
    if (forType === 'IN') {
      return { min: Math.min(MAX_QTY, Math.max(1, old - stock)), max: MAX_QTY };
    }
    return { min: 1, max: Math.min(MAX_QTY, stock - old) };
  };

  // Returns a safe integer quantity and (optionally) a message explaining the adjustment
  const clampQty = (item, rawValue, forType) => {
    const { min, max } = getBounds(item, forType);
    const parsed = parseInt(rawValue, 10);
    let val = Number.isFinite(parsed) ? parsed : min;
    let message = '';

    if (max < 1) {
      return {
        qty: 1,
        message: `Product "${item.product_name}" has no stock available to take out.`,
      };
    }
    if (val < min) {
      if (Number.isFinite(parsed) && min > 1) {
        message = `Quantity for "${item.product_name}" cannot go below ${min} — part of this stock has already been used elsewhere.`;
      }
      val = min;
    }
    if (val > max) {
      message = `Quantity for "${item.product_name}" exceeds available stock (max ${max}).`;
      val = max;
    }
    return { qty: val, message };
  };

  const setType = (newType) => {
    if (newType !== 'IN' && newType !== 'OUT') return;
    setTypeRaw(newType);

    if (!currentAdjustmentId) {
      setItems([]);
      setInvoiceNo(computeNextInvoiceNo(adjustments, newType));
      setError('');
      return;
    }

    // Editing an existing record: re-check every line against the new type's limits
    let firstMessage = '';
    const nextItems = items.map((it) => {
      const { qty, message } = clampQty(it, it.quantity, newType);
      if (message && !firstMessage) firstMessage = message;
      return { ...it, quantity: qty, subtotal: calcSubtotal(qty, toSafeNumber(it.purchase_price)) };
    });
    setItems(nextItems);
    setError(firstMessage);
  };

  const handleRemarksChange = (value) => {
    setRemarks(String(value ?? '').slice(0, MAX_REMARKS_LENGTH));
  };

  const handleNewAdd = (adjustmentList, forType) => {
    const useType = forType === 'OUT' ? 'OUT' : forType === 'IN' ? 'IN' : type || 'IN';
    setCurrentAdjustmentId(null);
    setItems([]);
    setOriginalEffects({});
    setTypeRaw(useType);
    setRemarks('');
    setInvoiceSearchQuery('');
    setAdjustmentDate(getToday());
    setError('');

    const listToProcess = Array.isArray(adjustmentList)
      ? adjustmentList
      : Array.isArray(adjustments)
      ? adjustments
      : [];
    setInvoiceNo(computeNextInvoiceNo(listToProcess, useType));
    setSuccess('Ready for New Adjustment Entry');
  };

  const handleClearForm = () => {
    handleNewAdd(adjustments, type);
  };

  const loadAdjustmentRecord = (a, { silent = false } = {}) => {
    if (!a || typeof a !== 'object') return;

    const aId = a.adjustment_id ?? a.id ?? null;
    if (aId === null || aId === undefined) {
      setError('Invalid adjustment record.');
      return;
    }

    setCurrentAdjustmentId(aId);
    const invNo = a.adj_invoice_no || a.invoice_no || '';
    setInvoiceSearchQuery(silent ? '' : invNo);
    setInvoiceNo(invNo);

    const recType = String(a.type || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN';
    setTypeRaw(recType);

    // Date (the API may return a full ISO datetime — only the YYYY-MM-DD part is needed)
    const rawDate = typeof a.adjustment_date === 'string' ? a.adjustment_date.slice(0, 10) : '';
    setAdjustmentDate(DATE_REGEX.test(rawDate) ? rawDate : getToday());

    setRemarks(String(a.remarks || '').slice(0, MAX_REMARKS_LENGTH));

    const rawItems = a.adjustment_details || a.details || a.items || [];
    const effects = {};

    if (Array.isArray(rawItems)) {
      const loadedItems = rawItems.map((i) => {
        const qty = Math.min(MAX_QTY, Math.max(1, Math.floor(toSafeNumber(i?.quantity, 1))));
        const price = Math.min(MAX_PRICE, Math.max(0, toSafeNumber(i?.purchase_price)));
        const prodInfo = i?.product && typeof i.product === 'object' ? i.product : {};

        const pid = String(i?.product_id);
        effects[pid] = (effects[pid] ?? 0) + (recType === 'IN' ? qty : -qty);

        return {
          product_id: i?.product_id,
          product_name: prodInfo.product_name || i?.product_name || 'Product',
          barcode: prodInfo.barcode || i?.barcode || '---',
          pack_size: getPackSizeName(prodInfo.pack_size_name, prodInfo.packSize, prodInfo.pack_size, i?.pack_size),
          quantity: qty,
          purchase_price: price,
          subtotal: calcSubtotal(qty, price),
          // current stock in the database (null = unknown)
          stock: parseStock(prodInfo.stock_qty ?? prodInfo.current_stock ?? prodInfo.stock),
        };
      });
      setItems(loadedItems);
    } else {
      setItems([]);
    }
    setOriginalEffects(effects);

    setError('');
    setSuccess(silent ? '' : `Loaded Adjustment: ${invNo}`);
  };

  const showLatestOrNew = (adjustmentList) => {
    if (Array.isArray(adjustmentList) && adjustmentList.length > 0) {
      const sorted = [...adjustmentList].sort(
        (a, b) => (b.adjustment_id || b.id || 0) - (a.adjustment_id || a.id || 0)
      );
      loadAdjustmentRecord(sorted[0]);
    } else {
      handleNewAdd(adjustmentList, 'IN');
    }
  };

  const fetchData = async () => {
    try {
      const [prodRes, adjRes] = await Promise.all([
        API.get('/products').catch(() => ({ data: { data: [] } })),
        API.get('/adjustments').catch(() => ({ data: { data: [] } })),
      ]);

      const productData = prodRes.data?.data ?? prodRes.data ?? [];
      const adjustmentData = adjRes.data?.data ?? adjRes.data ?? [];

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
      const res = await API.get('/company-profile');
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
      const clickedInsideCalendar = event.target?.closest && event.target.closest('.flatpickr-calendar');
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
    if (flatpickrInstanceRef.current && DATE_REGEX.test(String(adjustmentDate || ''))) {
      flatpickrInstanceRef.current.setDate(adjustmentDate, false);
    }
  }, [adjustmentDate]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ---------- Record navigation ----------
  const getSortedAsc = () =>
    [...adjustments].sort((a, b) => (a.adjustment_id || a.id || 0) - (b.adjustment_id || b.id || 0));

  const handleFirstRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    loadAdjustmentRecord(getSortedAsc()[0], { silent: true });
  };

  const handlePrevRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    const sorted = getSortedAsc();
    const currentIndex = sorted.findIndex((a) => getRecordId(a) === String(currentAdjustmentId ?? ''));
    loadAdjustmentRecord(currentIndex <= 0 ? sorted[0] : sorted[currentIndex - 1], { silent: true });
  };

  const handleNextRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    const sorted = getSortedAsc();
    const currentIndex = sorted.findIndex((a) => getRecordId(a) === String(currentAdjustmentId ?? ''));
    loadAdjustmentRecord(
      currentIndex === -1 || currentIndex >= sorted.length - 1 ? sorted[sorted.length - 1] : sorted[currentIndex + 1],
      { silent: true }
    );
  };

  const handleLastRecord = () => {
    if (!adjustments || adjustments.length === 0) return;
    const sorted = getSortedAsc();
    loadAdjustmentRecord(sorted[sorted.length - 1], { silent: true });
  };

  // NOTE: no side-effects (setError) inside setItems updaters — they must stay pure.
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

    const productDisplayName = String(product.product_name || product.name || 'Product');
    const sameProduct = (it) => String(it.product_id) === String(productId);
    const existing = items.find(sameProduct);

    if (existing) {
      const { max } = getBounds(existing, type);
      const nextQty = Math.min(MAX_QTY, toSafeNumber(existing.quantity, 0) + 1);

      if (nextQty > max) {
        setError(
          max < 1
            ? `Product "${productDisplayName}" has no stock to take out!`
            : `Cannot add more. Available stock is only ${max}`
        );
        return;
      }

      const price = Math.max(0, toSafeNumber(existing.purchase_price));
      setItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((it) =>
          sameProduct(it) ? { ...it, quantity: nextQty, subtotal: calcSubtotal(nextQty, price) } : it
        )
      );
    } else {
      const price = Math.min(
        MAX_PRICE,
        Math.max(0, toSafeNumber(product.purchase_price ?? product.sale_price ?? product.price, 0))
      );
      const newItem = {
        product_id: productId,
        product_name: productDisplayName,
        barcode: String(product.barcode || product.product_code || '---'),
        pack_size: getPackSizeName(product.pack_size_name, product.packSize, product.pack_size),
        quantity: 1,
        purchase_price: price,
        subtotal: calcSubtotal(1, price),
        stock: parseStock(product.stock_qty ?? product.current_stock ?? product.stock),
      };

      if (type === 'OUT' && getBounds(newItem, 'OUT').max < 1) {
        setError(`Product "${productDisplayName}" has no stock to take out!`);
        return;
      }

      setItems((prev) => [...(Array.isArray(prev) ? prev : []), newItem]);
    }

    setGlobalProductSearch('');
    setShowGlobalDropdown(false);
    setError('');
  };

  const handleItemChange = (index, field, value) => {
    const current = items[index];
    if (!current) return;

    let nextQty = current.quantity;
    let nextPrice = current.purchase_price;
    let message = '';

    if (field === 'quantity') {
      const result = clampQty(current, value, type);
      nextQty = result.qty;
      message = result.message;
    } else if (field === 'purchase_price') {
      let val = parseFloat(value);
      if (!Number.isFinite(val) || val < 0) val = 0;
      if (val > MAX_PRICE) val = MAX_PRICE;
      nextPrice = val;
    } else {
      return;
    }

    setItems((prevItems) => {
      if (!Array.isArray(prevItems) || !prevItems[index]) return prevItems;
      const newItems = [...prevItems];
      newItems[index] = {
        ...newItems[index],
        quantity: nextQty,
        purchase_price: nextPrice,
        subtotal: calcSubtotal(nextQty, nextPrice),
      };
      return newItems;
    });
    setError(message);
  };

  const removeRow = (index) => {
    const item = items[index];
    if (!item) return;

    // Removing a saved line takes its old effect away completely (new effect = 0).
    // If that would push stock below zero (e.g. an IN line whose stock was already used), block it.
    if (currentAdjustmentId && item.stock !== null && item.stock !== undefined) {
      const old = originalEffects[String(item.product_id)] ?? 0;
      if (item.stock - old < 0) {
        setError(
          `Cannot remove "${item.product_name}" — its stock from this adjustment has already been used elsewhere.`
        );
        return;
      }
    }

    setError('');
    setItems((prevItems) => (Array.isArray(prevItems) ? prevItems.filter((_, i) => i !== index) : []));
  };

  // ---------- Totals ----------
  const totalQty = items.reduce((sum, item) => sum + Math.max(0, Math.floor(toSafeNumber(item.quantity))), 0);
  const totalValue = round2(
    items.reduce(
      (sum, item) =>
        sum + round2(Math.max(0, toSafeNumber(item.quantity)) * Math.max(0, toSafeNumber(item.purchase_price))),
      0
    )
  );

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return false; // double-submit guard

    if (!Array.isArray(items) || items.length === 0) {
      setError('Please add at least one product to the adjustment list!');
      return false;
    }

    if (!DATE_REGEX.test(String(adjustmentDate || ''))) {
      setError('Please enter a valid adjustment date (YYYY-MM-DD).');
      return false;
    }

    const payload = {
      type: type === 'OUT' ? 'OUT' : 'IN',
      adjustment_date: adjustmentDate,
      remarks: String(remarks || '').trim().slice(0, MAX_REMARKS_LENGTH),
      items: items.map((i) => ({
        product_id: parseInt(i.product_id, 10),
        quantity: Math.min(MAX_QTY, Math.max(1, parseInt(i.quantity, 10) || 1)),
        purchase_price: Math.min(MAX_PRICE, Math.max(0, toSafeNumber(i.purchase_price))),
      })),
    };

    const hasInvalidProductId = payload.items.some(
      (item) => !Number.isInteger(item.product_id) || item.product_id <= 0
    );
    if (hasInvalidProductId) {
      setError('One or more selected products are invalid.');
      return false;
    }

    if (currentAdjustmentId) {
      const isConfirmed = window.confirm('Are you sure you want to update this adjustment record?');
      if (!isConfirmed) return false;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let savedAdjustment;
      let doneMessage;
      if (currentAdjustmentId) {
        const res = await API.put(`/adjustments/${currentAdjustmentId}`, payload);
        savedAdjustment = res.data?.data;
        doneMessage = 'Adjustment updated successfully!';
      } else {
        const res = await API.post('/adjustments', payload);
        savedAdjustment = res.data?.data;
        doneMessage = 'Adjustment recorded successfully!';
      }

      const updatedAdjustments = await fetchData();

      // Prefer the freshly fetched record (fresh stock numbers + relations)
      const freshRecord =
        savedAdjustment && updatedAdjustments.find((a) => getRecordId(a) === getRecordId(savedAdjustment));
      const recordToShow = freshRecord || savedAdjustment;

      if (recordToShow) {
        loadAdjustmentRecord(recordToShow, { silent: true });
      } else {
        showLatestOrNew(updatedAdjustments);
      }

      // Set last so "Loaded Adjustment..." never overwrites it
      setSuccess(doneMessage);
      return true;
    } catch (err) {
      const validationErrors = err.response?.data?.errors;
      let errorMessage = err.response?.data?.message || err.response?.data?.error;
      if (validationErrors && typeof validationErrors === 'object') {
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
    if (loading) return;
    if (!currentAdjustmentId) {
      setError('Please select an existing adjustment record to delete.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this adjustment record? Stock changes will be reversed.')) return;

    try {
      setLoading(true);
      setError('');
      await API.delete(`/adjustments/${currentAdjustmentId}`);
      const updatedAdjustments = await fetchData();
      showLatestOrNew(updatedAdjustments);
      setSuccess('Adjustment deleted successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete adjustment record.');
    } finally {
      setLoading(false);
    }
  };

  // Pressing Enter inside an input must not accidentally submit the form
  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter' && e.target?.tagName === 'INPUT') {
      e.preventDefault();
    }
  };

  // Quantity must be a whole number — block decimal / exponent / sign keys
  const blockNonIntegerKeys = (e) => {
    if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const invoiceQuery = invoiceSearchQuery.trim().toLowerCase();
  const filteredAdjustments = invoiceQuery
    ? adjustments.filter((a) =>
        String(a.adj_invoice_no || a.invoice_no || '').toLowerCase().includes(invoiceQuery)
      )
    : [];

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
                maxLength={50}
                autoComplete="off"
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

            {showInvoiceDropdown && invoiceQuery !== '' && (
              <ul className="absolute z-40 left-0 w-full bg-white text-gray-800 border border-gray-300 rounded-md top-full mt-1 max-h-48 overflow-y-auto shadow-lg">
                {filteredAdjustments.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-gray-400">No adjustment found</li>
                ) : (
                  filteredAdjustments.map((a) => {
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

        <form id="adjustment-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
          <Adjustment_update
            type={type}
            setType={setType}
            invoiceNo={invoiceNo}
            dateInputRef={dateInputRef}
            adjustmentDate={adjustmentDate}
            setAdjustmentDate={setAdjustmentDate}
            remarks={remarks}
            setRemarks={handleRemarksChange}
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
                    <th className="py-2 px-3">Product Code</th>
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
                    items.map((item, index) => {
                      const { min, max } = getBounds(item, type);
                      return (
                        <tr key={`${item.product_id ?? 'product'}-${index}`} className="hover:bg-gray-50 transition">
                          <td className="py-2 px-3 text-center font-semibold text-gray-500">{index + 1}</td>
                          <td className="py-2 px-3 font-medium text-gray-800">{item.product_name}</td>
                          <td className="py-2 px-3 font-mono text-gray-600">{item.barcode}</td>
                          <td className="py-2 px-3 text-gray-600">{item.pack_size}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={min}
                              max={Math.max(min, max)}
                              step="1"
                              value={item.quantity}
                              onKeyDown={blockNonIntegerKeys}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={MAX_PRICE}
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
                      );
                    })
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