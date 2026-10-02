import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import Purchase_arrow from './Purchase_arrow';
import Purchase_update from './Purchase_update';
import Purchase_print from './Purchase_print';

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

// Payment type normalize
const normalizePaymentType = (value) => {
  const type = String(value ?? '').trim().toLowerCase();
  if (type === 'bank') return 'Bank';
  if (type === 'mobile banking' || type === 'mobile_banking') return 'Mobile Banking';
  return 'Cash';
};

export default function Purchase() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [shopInfo, setShopInfo] = useState({});

  // Form States
  const [currentPurchaseId, setCurrentPurchaseId] = useState(null);

  // Supplier selection states
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Calculation & Payment States
  const [discountType, setDiscountType] = useState('Flat');
  const [discountValue, setDiscountValue] = useState('');
  const [vatPercentage, setVatPercentage] = useState('0'); // VAT default 0%
  const [paymentType, setPaymentType] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');

  // Purchase Details Items List
  const [items, setItems] = useState([]);

  // Global Product Search State
  const [globalProductSearch, setGlobalProductSearch] = useState('');
  const [showGlobalDropdown, setShowGlobalDropdown] = useState(false);

  // Invoice Search State
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const dateInputRef = useRef(null);
  const globalSearchRef = useRef(null);
  const supplierSearchRef = useRef(null);
  const invoiceSearchRef = useRef(null);
  const flatpickrInstanceRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const handlePrintAction = () => {
    window.print();
  };

  const selectedSupplier =
    suppliers.find(
      (s) => String(s.supplier_id ?? s.id ?? '') === String(selectedSupplierId ?? '')
    ) || null;

  const handleSupplierSearchChange = (value) => {
    setSupplierSearchQuery(value);
    // টাইপ করলে আগের selection বাতিল
    setSelectedSupplierId(null);
  };

  const handleSelectSupplier = (supplier) => {
    if (!supplier || typeof supplier !== 'object') return;

    const supplierId = supplier.supplier_id ?? supplier.id ?? null;
    if (supplierId === null || supplierId === undefined) {
      setError('Invalid supplier selected.');
      return;
    }

    setSelectedSupplierId(supplierId);
    setSupplierSearchQuery(String(supplier.supplier_name || supplier.name || ''));
    setShowSupplierDropdown(false);
    setError('');
  };

  const handleNewAdd = (purchaseList) => {
    setCurrentPurchaseId(null);
    setItems([]);
    setDiscountType('Flat');
    setDiscountValue('');
    setVatPercentage('0');
    setPaymentType('Cash');
    setPaidAmount('');
    setSelectedSupplierId(null);
    setSupplierSearchQuery('');
    setRemarks('');
    setInvoiceSearchQuery('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setError('');

    const listToProcess = Array.isArray(purchaseList) ? purchaseList : (Array.isArray(purchases) ? purchases : []);

    if (listToProcess.length === 0) {
      setInvoiceNo('INV-PURCHASE-000001');
      setSuccess('Ready for New Purchase Entry');
      return;
    }

    const sorted = [...listToProcess].sort((a, b) => (b.purchase_id || b.id || 0) - (a.purchase_id || a.id || 0));
    const lastPurchase = sorted[0];
    let nextSeq = 1;

    if (lastPurchase && (lastPurchase.purchase_pos_no || lastPurchase.invoice_no)) {
      const posNo = lastPurchase.purchase_pos_no || lastPurchase.invoice_no;
      const matches = String(posNo).match(/(\d+)$/);
      if (matches && matches[1]) {
        nextSeq = parseInt(matches[1], 10) + 1;
      }
    }

    setInvoiceNo(`INV-PUR-${String(nextSeq).padStart(6, '0')}`);
    setSuccess('Ready for New Purchase Entry');
  };

  const handleClearForm = () => {
    handleNewAdd(purchases);
  };

  const loadPurchaseRecord = (p, { silent = false } = {}) => {
    if (!p || typeof p !== 'object') return;

    const pId = p.purchase_id ?? p.id ?? null;
    if (pId === null || pId === undefined) {
      setError('Invalid purchase record.');
      return;
    }

    setCurrentPurchaseId(pId);

    const invNo = p.purchase_pos_no || p.invoice_no || '';
    if (silent) {
      setInvoiceSearchQuery('');
    } else {
      setInvoiceSearchQuery(invNo);
    }
    setInvoiceNo(invNo);

    // Supplier
    const supplierInfo = p.supplier && typeof p.supplier === 'object' ? p.supplier : {};
    setSelectedSupplierId(p.supplier_id ?? supplierInfo.supplier_id ?? supplierInfo.id ?? null);
    setSupplierSearchQuery(String(supplierInfo.supplier_name || supplierInfo.name || ''));

    // Date
    setPurchaseDate(p.purchase_date || new Date().toISOString().split('T')[0]);

    // Remarks
    setRemarks(p.remarks || '');

    // VAT
    setVatPercentage(String(p.vat_percentage ?? 0));

    // Discount
    setDiscountType(toSafeNumber(p.discount_percentage) > 0 ? 'Percentage' : 'Flat');
    setDiscountValue(
      String(toSafeNumber(p.discount_percentage) > 0 ? p.discount_percentage : (p.discount_flat || p.discount_amount || ''))
    );

    // Payment
    const lastPayment = Array.isArray(p.payments) && p.payments.length > 0 ? p.payments[p.payments.length - 1] : null;
    setPaymentType(normalizePaymentType(lastPayment?.payment_type || p.payment_type));

    const totalPaid = Array.isArray(p.payments)
      ? p.payments.reduce((sum, pay) => sum + toSafeNumber(pay?.paid_amount), 0)
      : toSafeNumber(p.paid_amount, 0);
    setPaidAmount(String(totalPaid > 0 ? totalPaid : ''));

    // Purchase Items
    const rawItems = p.details || p.items || [];
    if (Array.isArray(rawItems)) {
      const loadedItems = rawItems.map((i) => {
        const qty = Math.max(1, toSafeNumber(i?.quantity, 1));
        const price = Math.max(0, toSafeNumber(i?.purchase_price, 0));
        const prodInfo = i?.product && typeof i.product === 'object' ? i.product : {};

        // এই লাইনটার জন্য ন্যূনতম এডিটেবল কোয়ান্টিটি —
        // সূত্র: max(0, এই পারচেজে মূল কোয়ান্টিটি − প্রোডাক্টের বর্তমান মোট স্টক)।
        // ব্যাকএন্ডের applyStockDelta() ঠিক এই একই সূত্র দিয়ে যাচাই করে, তাই এখানে
        // ফ্রন্টএন্ডে আগেভাগে আটকে দিলে সেভ করার সময় ব্যাকএন্ডের রিজেকশনে পড়তে হয় না।
        const currentStock = toSafeNumber(
          prodInfo.stock_qty ?? prodInfo.current_stock ?? prodInfo.stock,
          0
        );
        const minEditQuantity = Math.max(0, qty - currentStock);

        return {
          product_id: i?.product_id,
          product_name: prodInfo.product_name || i?.product_name || 'Product',
          barcode: prodInfo.barcode || i?.barcode || '---',
          pack_size: getPackSizeName(prodInfo.pack_size_name, prodInfo.packSize, prodInfo.pack_size, i?.pack_size),
          quantity: qty,
          purchase_price: price,
          subtotal: (qty * price).toFixed(2),
          minEditQuantity,
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
      setSuccess(`Loaded Purchase: ${invNo}`);
    }
  };

  const showLatestOrNew = (purchaseList) => {
    if (Array.isArray(purchaseList) && purchaseList.length > 0) {
      const sorted = [...purchaseList].sort((a, b) => (b.purchase_id || b.id || 0) - (a.purchase_id || a.id || 0));
      loadPurchaseRecord(sorted[0]);
    } else {
      handleNewAdd(purchaseList);
    }
  };

  const fetchData = async () => {
    try {
      const [prodRes, purchaseRes, supplierRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/products`, getAuthHeaders()).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_BASE_URL}/purchases`, getAuthHeaders()).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_BASE_URL}/suppliers`, getAuthHeaders()).catch(() => ({ data: { data: [] } })),
      ]);

      const productData = prodRes.data?.data ?? prodRes.data ?? [];
      const purchaseData = purchaseRes.data?.data ?? purchaseRes.data ?? [];
      const supplierData = supplierRes.data?.data ?? supplierRes.data ?? [];

      setProducts(Array.isArray(productData) ? productData : []);
      setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);

      return Array.isArray(purchaseData) ? purchaseData : [];
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
    fetchData().then((purchaseData) => {
      if (!cancelled) showLatestOrNew(purchaseData);
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
      if (supplierSearchRef.current && !supplierSearchRef.current.contains(event.target)) {
        setShowSupplierDropdown(false);
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

  // =========================================================
  // Flatpickr — screenshot অনুযায়ী: Header/Weekday/Selected = #417690
  // =========================================================
  useEffect(() => {
    if (dateInputRef.current && !flatpickrInstanceRef.current) {
      flatpickrInstanceRef.current = flatpickr(dateInputRef.current, {
        dateFormat: 'Y-m-d',
        defaultDate: purchaseDate,
        allowInput: true,
        clickOpens: true,
        closeOnSelect: true,
        disableMobile: true,
        monthSelectorType: 'dropdown',
        onChange: (selectedDates, dateStr) => {
          if (dateStr) setPurchaseDate(dateStr);
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
    if (flatpickrInstanceRef.current && purchaseDate) {
      flatpickrInstanceRef.current.setDate(purchaseDate, false);
    }
  }, [purchaseDate]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleFirstRecord = () => {
    if (!purchases || purchases.length === 0) return;
    const sorted = [...purchases].sort((a, b) => (a.purchase_id || a.id || 0) - (b.purchase_id || b.id || 0));
    loadPurchaseRecord(sorted[0], { silent: true });
  };

  const handlePrevRecord = () => {
    if (!purchases || purchases.length === 0) return;
    const sorted = [...purchases].sort((a, b) => (a.purchase_id || a.id || 0) - (b.purchase_id || b.id || 0));
    const currentIndex = sorted.findIndex((p) => String(p.purchase_id ?? p.id ?? '') === String(currentPurchaseId ?? ''));
    loadPurchaseRecord(currentIndex <= 0 ? sorted[0] : sorted[currentIndex - 1], { silent: true });
  };

  const handleNextRecord = () => {
    if (!purchases || purchases.length === 0) return;
    const sorted = [...purchases].sort((a, b) => (a.purchase_id || a.id || 0) - (b.purchase_id || b.id || 0));
    const currentIndex = sorted.findIndex((p) => String(p.purchase_id ?? p.id ?? '') === String(currentPurchaseId ?? ''));
    loadPurchaseRecord(
      currentIndex === -1 || currentIndex >= sorted.length - 1 ? sorted[sorted.length - 1] : sorted[currentIndex + 1],
      { silent: true }
    );
  };

  const handleLastRecord = () => {
    if (!purchases || purchases.length === 0) return;
    const sorted = [...purchases].sort((a, b) => (a.purchase_id || a.id || 0) - (b.purchase_id || b.id || 0));
    loadPurchaseRecord(sorted[sorted.length - 1], { silent: true });
  };

  // Purchase-এ Sales-এর মতো স্টক-scarcity সীমা নেই — নতুন যোগ করা আইটেমের
  // minEditQuantity সবসময় 0 (এই এডিট সেশনে নতুন যোগ করা, আগের কোনো পারচেজ-লাইন নয়)
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

    setItems((prevItems) => {
      const safePrevItems = Array.isArray(prevItems) ? prevItems : [];
      const existingIndex = safePrevItems.findIndex((item) => String(item.product_id) === String(productId));
      const packSizeText = getPackSizeName(product.pack_size_name, product.packSize, product.pack_size);

      if (existingIndex > -1) {
        const nextQty = toSafeNumber(safePrevItems[existingIndex].quantity, 0) + 1;
        const price = Math.max(0, toSafeNumber(safePrevItems[existingIndex].purchase_price, 0));
        const newItems = [...safePrevItems];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: nextQty,
          subtotal: (nextQty * price).toFixed(2),
        };
        return newItems;
      }

      // রেফারেন্স হিসেবে প্রোডাক্টের নিজস্ব purchase_price (কস্ট প্রাইস) ব্যবহার করা হচ্ছে
      const price = Math.max(0, toSafeNumber(product.purchase_price ?? product.sale_price ?? product.price, 0));
      const newItem = {
        product_id: productId,
        product_name: productDisplayName,
        barcode: String(product.barcode || '---'),
        pack_size: packSizeText,
        quantity: 1,
        purchase_price: price,
        subtotal: price.toFixed(2),
        minEditQuantity: 0,
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
        // এই লাইনটা যদি বিদ্যমান পারচেজের অংশ হয় এবং তার কিছু অংশ ইতিমধ্যে বিক্রি হয়ে
        // থাকে (minEditQuantity > 0), তাহলে সেই সীমার নিচে নামানো যাবে না — ব্যাকএন্ডও
        // একই নিয়ম প্রয়োগ করবে, তাই সেভ করার আগেই এখানে আটকে দেওয়া হচ্ছে।
        const floorQty = Math.max(1, toSafeNumber(newItems[index].minEditQuantity, 0));
        if (!Number.isFinite(val) || val < floorQty) {
          if (Number.isFinite(val) && floorQty > 1) {
            setError(
              `Quantity for "${newItems[index].product_name}" cannot go below ${floorQty} — ${floorQty} unit(s) from this purchase have already been sold.`
            );
          } else {
            setError('');
          }
          val = floorQty;
        } else {
          setError('');
        }
        newItems[index] = { ...newItems[index], quantity: val };
      } else if (field === 'purchase_price') {
        if (!Number.isFinite(val) || val < 0) val = 0;
        newItems[index] = { ...newItems[index], purchase_price: val };
      }

      const qty = Math.max(1, toSafeNumber(newItems[index].quantity, 1));
      const price = Math.max(0, toSafeNumber(newItems[index].purchase_price, 0));
      newItems[index] = { ...newItems[index], quantity: qty, purchase_price: price, subtotal: (qty * price).toFixed(2) };
      return newItems;
    });
  };

  const removeRow = (index) => {
    setItems((prevItems) => {
      if (!Array.isArray(prevItems)) return [];
      const item = prevItems[index];
      // এই লাইনের কিছু অংশ ইতিমধ্যে বিক্রি হয়ে থাকলে পুরো লাইনটা মুছে ফেলা যাবে না
      // (ব্যাকএন্ডেও ব্লক হবে, কিন্তু ফ্রন্টএন্ডেই আগে জানিয়ে দেওয়া ভালো UX)
      if (item && toSafeNumber(item.minEditQuantity, 0) > 0) {
        setError(
          `Cannot remove "${item.product_name}" — ${item.minEditQuantity} unit(s) from this purchase have already been sold.`
        );
        return prevItems;
      }
      setError('');
      return prevItems.filter((_, i) => i !== index);
    });
  };

  // Calculations
  const subtotalAmount = items.reduce((sum, item) => sum + toSafeNumber(item?.subtotal, 0), 0);
  const vatRate = Math.min(100, Math.max(0, toSafeNumber(vatPercentage, 0)));
  const vatAmount = (subtotalAmount * vatRate) / 100;
  const subTotalWithVat = subtotalAmount + vatAmount;

  const rawDiscount = Math.max(0, toSafeNumber(discountValue, 0));
  // ডিসকাউন্ট কখনো VAT-সহ সাবটোটালের চেয়ে বেশি দেখানো হবে না
  const calculatedDiscountAmount = Math.min(
    subTotalWithVat,
    discountType === 'Percentage' ? (subTotalWithVat * Math.min(100, rawDiscount)) / 100 : rawDiscount
  );

  const totalAmount = Math.max(0, subTotalWithVat - calculatedDiscountAmount).toFixed(2);

  // Paid Amount কখনো Payable Total-এর বেশি হবে না
  const numericPaid = Math.max(0, toSafeNumber(paidAmount, 0));
  const finalPaidAmount = Math.min(numericPaid, toSafeNumber(totalAmount, 0));
  const dueAmount = Math.max(0, toSafeNumber(totalAmount, 0) - finalPaidAmount).toFixed(2);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!selectedSupplierId) {
      setError('Please select a supplier from the list!');
      return false;
    }

    if (!Array.isArray(items) || items.length === 0) {
      setError('Please add at least one product to the purchase list!');
      return false;
    }

    if (currentPurchaseId) {
      const isConfirmed = window.confirm('Are you sure you want to update this purchase record?');
      if (!isConfirmed) return false;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      supplier_id: selectedSupplierId,
      purchase_date: purchaseDate,
      vat_percentage: vatRate,
      discount_flat: discountType === 'Flat' ? Math.min(rawDiscount, subTotalWithVat) : 0,
      discount_percentage: discountType === 'Percentage' ? Math.min(100, rawDiscount) : 0,
      remarks: String(remarks || '').trim(),
      items: items.map((i) => ({
        product_id: parseInt(i.product_id, 10),
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
        purchase_price: Math.max(0, toSafeNumber(i.purchase_price, 0)),
      })),
      paid_amount: finalPaidAmount,
      payment_type: normalizePaymentType(paymentType),
    };

    // Invalid product IDs prevent accidental bad request
    const hasInvalidProductId = payload.items.some(
      (item) => !Number.isInteger(item.product_id) || item.product_id <= 0
    );
    if (hasInvalidProductId) {
      setError('One or more selected products are invalid.');
      setLoading(false);
      return false;
    }

    try {
      let savedPurchase;
      if (currentPurchaseId) {
        const res = await axios.put(`${API_BASE_URL}/purchases/${currentPurchaseId}`, payload, getAuthHeaders());
        savedPurchase = res.data?.data;
        setSuccess('Purchase updated successfully!');
      } else {
        const res = await axios.post(`${API_BASE_URL}/purchases`, payload, getAuthHeaders());
        savedPurchase = res.data?.data;
        setSuccess('Purchase recorded successfully!');
      }

      const updatedPurchases = await fetchData();
      if (savedPurchase) {
        loadPurchaseRecord(savedPurchase);
      } else {
        showLatestOrNew(updatedPurchases);
      }

      return true;
    } catch (err) {
      const validationErrors = err.response?.data?.errors;
      let errorMessage = err.response?.data?.message || err.response?.data?.error;
      if (validationErrors && typeof validationErrors === 'object') {
        errorMessage = Object.values(validationErrors).flat().join(' ');
      }
      setError(errorMessage || 'Failed to save purchase!');
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
    if (!currentPurchaseId) {
      setError('Please select an existing purchase record to delete.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this purchase record?')) return;

    try {
      setLoading(true);
      setError('');
      await axios.delete(`${API_BASE_URL}/purchases/${currentPurchaseId}`, getAuthHeaders());
      setSuccess('Purchase deleted successfully!');
      const updatedPurchases = await fetchData();
      showLatestOrNew(updatedPurchases);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete purchase record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800">

      {/* FLATPICKR CALENDAR STYLE — Main Color = #417690 */}
      <style>{`
        .flatpickr-calendar {
          width: 307px !important;
          background: #ffffff !important;
          border: 1px solid #417690 !important;
          border-radius: 4px !important;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15) !important;
          overflow: hidden !important;
        }
        .flatpickr-calendar .flatpickr-months {
          background: #417690 !important;
          color: #ffffff !important;
        }
        .flatpickr-calendar .flatpickr-month {
          background: #417690 !important;
          color: #ffffff !important;
          fill: #ffffff !important;
          height: 54px !important;
        }
        .flatpickr-calendar .flatpickr-current-month {
          color: #ffffff !important;
          font-size: 16px !important;
          font-weight: 400 !important;
          padding-top: 10px !important;
        }
        .flatpickr-calendar .flatpickr-current-month .cur-month,
        .flatpickr-calendar .flatpickr-current-month .cur-year {
          color: #ffffff !important;
          font-weight: 400 !important;
        }
        .flatpickr-calendar .flatpickr-current-month select.flatpickr-monthDropdown-months {
          background: #417690 !important;
          color: #ffffff !important;
          font-weight: 400 !important;
          border: none !important;
          outline: none !important;
        }
        .flatpickr-calendar .flatpickr-current-month select.flatpickr-monthDropdown-months option {
          background: #417690 !important;
          color: #ffffff !important;
          font-weight: 400 !important;
        }
        .flatpickr-calendar .flatpickr-months .flatpickr-prev-month,
        .flatpickr-calendar .flatpickr-months .flatpickr-next-month {
          color: #ffffff !important;
          fill: #ffffff !important;
          top: 0 !important;
          height: 54px !important;
          padding: 15px 12px !important;
        }
        .flatpickr-calendar .flatpickr-months .flatpickr-prev-month:hover,
        .flatpickr-calendar .flatpickr-months .flatpickr-next-month:hover {
          background: rgba(255, 255, 255, 0.10) !important;
          color: #ffffff !important;
          fill: #ffffff !important;
        }
        .flatpickr-calendar .flatpickr-weekdays {
          background: #417690 !important;
        }
        .flatpickr-calendar span.flatpickr-weekday {
          background: #417690 !important;
          color: #ffffff !important;
          font-size: 13px !important;
          font-weight: 700 !important;
        }
        .flatpickr-calendar .flatpickr-days,
        .flatpickr-calendar .dayContainer {
          background: #ffffff !important;
        }
        .flatpickr-calendar .flatpickr-day {
          color: #4b4b4b !important;
          border-radius: 50% !important;
          font-size: 14px !important;
          font-weight: 400 !important;
        }
        .flatpickr-calendar .flatpickr-day:hover {
          background: #e7f0f4 !important;
          border-color: #e7f0f4 !important;
          color: #315d70 !important;
        }
        .flatpickr-calendar .flatpickr-day.selected,
        .flatpickr-calendar .flatpickr-day.startRange,
        .flatpickr-calendar .flatpickr-day.endRange {
          background: #417690 !important;
          border-color: #417690 !important;
          color: #ffffff !important;
          border-radius: 50% !important;
          font-weight: 500 !important;
        }
        .flatpickr-calendar .flatpickr-day.selected:hover,
        .flatpickr-calendar .flatpickr-day.startRange:hover,
        .flatpickr-calendar .flatpickr-day.endRange:hover {
          background: #345e73 !important;
          border-color: #345e73 !important;
          color: #ffffff !important;
        }
        .flatpickr-calendar .flatpickr-day.today {
          border-color: #417690 !important;
          color: #417690 !important;
          font-weight: 600 !important;
        }
        .flatpickr-calendar .flatpickr-day.today:hover {
          background: #e7f0f4 !important;
          border-color: #417690 !important;
          color: #315d70 !important;
        }
        .flatpickr-calendar .flatpickr-day.today.selected {
          background: #417690 !important;
          border-color: #417690 !important;
          color: #ffffff !important;
        }
        .flatpickr-calendar .flatpickr-day.prevMonthDay,
        .flatpickr-calendar .flatpickr-day.nextMonthDay {
          color: #c8c8c8 !important;
        }
        .flatpickr-calendar .flatpickr-day.prevMonthDay:hover,
        .flatpickr-calendar .flatpickr-day.nextMonthDay:hover {
          background: #f5f8fa !important;
          border-color: #f5f8fa !important;
          color: #9ca3af !important;
        }
        .flatpickr-calendar .flatpickr-day.flatpickr-disabled {
          color: #d0d0d0 !important;
        }
        @media (max-width: 480px) {
          .flatpickr-calendar {
            width: 100% !important;
            max-width: 307px !important;
          }
        }
      `}</style>

      <Purchase_print
        purchaseData={{
          purchase_pos_no: invoiceNo,
          purchase_date: purchaseDate,
          supplier_name: selectedSupplier?.supplier_name || selectedSupplier?.name || supplierSearchQuery,
          supplier_phone: selectedSupplier?.phone || '',
          remarks,
          vat_percentage: vatRate,
          vat_amount: vatAmount,
          discount_flat: calculatedDiscountAmount,
          payable_amount: totalAmount,
          paid_amount: finalPaidAmount,
          payment_type: paymentType,
          details: items,
        }}
        shopInfo={shopInfo}
      />

      <div className="print:hidden">

        <div className="grid grid-cols-1 md:grid-cols-3 items-center mb-3 bg-[#417690] text-white px-3 py-1.5 rounded-lg shadow-sm gap-3">
          <div className="flex items-center">
            <h1 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap">
              📦 Purchase / Stock-In Form
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
                placeholder="Search by Purchase No..."
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
                {purchases.filter((p) =>
                  String(p.purchase_pos_no || p.invoice_no || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase())
                ).length === 0 ? (
                  <li className="px-3 py-2 text-xs text-gray-400">No purchase found</li>
                ) : (
                  purchases
                    .filter((p) =>
                      String(p.purchase_pos_no || p.invoice_no || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase())
                    )
                    .map((p) => {
                      const invNo = p.purchase_pos_no || p.invoice_no;
                      const supName = p.supplier?.supplier_name || p.supplier?.name || 'N/A';
                      const total = p.payable_amount || p.total_amount || 0;
                      return (
                        <li
                          key={p.purchase_id || p.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            loadPurchaseRecord(p);
                            setShowInvoiceDropdown(false);
                          }}
                          className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 flex justify-between items-center"
                        >
                          <span className="font-mono font-bold text-[#417690]">{invNo}</span>
                          <span className="text-gray-500 text-[11px]">{supName} - ৳{total}</span>
                        </li>
                      );
                    })
                )}
              </ul>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-xs sm:text-sm font-semibold">{error}</div>}

        <form id="purchase-form" onSubmit={handleSubmit}>
          <Purchase_update
            supplierSearchRef={supplierSearchRef}
            supplierSearchQuery={supplierSearchQuery}
            onSupplierSearchChange={handleSupplierSearchChange}
            showSupplierDropdown={showSupplierDropdown}
            setShowSupplierDropdown={setShowSupplierDropdown}
            suppliers={suppliers}
            selectedSupplier={selectedSupplier}
            onSelectSupplier={handleSelectSupplier}
            invoiceNo={invoiceNo}
            dateInputRef={dateInputRef}
            purchaseDate={purchaseDate}
            setPurchaseDate={setPurchaseDate}
            remarks={remarks}
            setRemarks={setRemarks}
            globalSearchRef={globalSearchRef}
            globalProductSearch={globalProductSearch}
            setGlobalProductSearch={setGlobalProductSearch}
            showGlobalDropdown={showGlobalDropdown}
            setShowGlobalDropdown={setShowGlobalDropdown}
            products={products}
            addProductToTable={addProductToTable}
            subtotalAmount={subtotalAmount}
            vatPercentage={vatPercentage}
            setVatPercentage={setVatPercentage}
            vatAmount={vatAmount}
            subTotalWithVat={subTotalWithVat}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            calculatedDiscountAmount={calculatedDiscountAmount}
            paymentType={paymentType}
            setPaymentType={setPaymentType}
            totalAmount={totalAmount}
            paidAmount={finalPaidAmount}
            setPaidAmount={setPaidAmount}
            dueAmount={dueAmount}
          />

          <div className="mt-4 bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2 bg-[#417690] p-2 rounded-md">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleNewAdd(purchases)}
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
                  <span>💾</span> {currentPurchaseId ? 'Update Button' : 'Save Button'}
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
                  disabled={!currentPurchaseId || loading}
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

              <Purchase_arrow
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
                    <th className="py-2 px-3 text-right w-28">Purchase Price (৳)</th>
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
                      const minQty = toSafeNumber(item.minEditQuantity, 0);
                      const isLocked = minQty > 0;
                      return (
                        <tr key={`${item.product_id ?? 'product'}-${index}`} className="hover:bg-gray-50 transition">
                          <td className="py-2 px-3 text-center font-semibold text-gray-500">{index + 1}</td>
                          <td className="py-2 px-3 font-medium text-gray-800">{item.product_name}</td>
                          <td className="py-2 px-3 font-mono text-gray-600">{item.barcode}</td>
                          <td className="py-2 px-3 text-gray-600">{item.pack_size}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min={Math.max(1, minQty)}
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
                          <td className="py-2 px-3 text-right font-bold text-[#417690]">৳{item.subtotal}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              disabled={isLocked}
                              title={isLocked ? `${minQty} unit(s) already sold — cannot remove this line` : 'Remove item'}
                              className={`font-bold p-1 rounded ${
                                isLocked ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700'
                              }`}
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