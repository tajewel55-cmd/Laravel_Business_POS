import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import Sale_arrow from './Sale_arrow';
import Sale_update from './Sale_update';
import Sale_print from './Sale_print';

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

const normalizePaymentType = (value) => {
  const type = String(value ?? '').trim().toLowerCase();

  if (type === 'bank') return 'Bank';

  if (type === 'mobile banking' || type === 'mobile_banking') {
    return 'Mobile Banking';
  }

  return 'Cash';
};

export default function Sale() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [shopInfo, setShopInfo] = useState({});

  // Form States
  const [currentSaleId, setCurrentSaleId] = useState(null);

  // Customer details states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [invoiceNo, setInvoiceNo] = useState('');

  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Calculation & Payment States
  const [discountType, setDiscountType] = useState('Flat');
  const [discountValue, setDiscountValue] = useState('');
  const [vatPercentage, setVatPercentage] = useState('0'); // VAT ডিফল্ট 0% (Default VAT: 0%) ৩ জায়গায় কারেকশন করতে হবে
  const [paymentType, setPaymentType] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');

  // Sale Details Items List
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
  const invoiceSearchRef = useRef(null);
  const flatpickrInstanceRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } };
  };

  const handlePrintAction = () => {
    window.print();
  };

  const handleNewAdd = (saleList) => {
    setCurrentSaleId(null);
    setItems([]);
    setDiscountType('Flat');
    setDiscountValue('');
    setVatPercentage('0'); // VAT ডিফল্ট 0% (Default VAT: 0%) ৩ জায়গায় কারেকশন করতে হবে
    setPaymentType('Cash');
    setPaidAmount('');
    setCustomerName('');
    setCustomerPhone('');
    setRemarks('');
    setInvoiceSearchQuery('');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setError('');

    const listToProcess = Array.isArray(saleList) ? saleList : (Array.isArray(sales) ? sales : []);
    if (listToProcess.length === 0) {
      setInvoiceNo('INV-SALE-000001');
      setSuccess('Ready for New Sale Entry');
      return;
    }

    const sorted = [...listToProcess].sort((a, b) => (b.sale_id || b.id || 0) - (a.sale_id || a.id || 0));
    const lastSale = sorted[0];
    let nextSeq = 1;

    if (lastSale && (lastSale.sale_pos_no || lastSale.invoice_no)) {
      const posNo = lastSale.sale_pos_no || lastSale.invoice_no;
      const matches = String(posNo).match(/(\d+)$/);
      if (matches && matches[1]) {
        nextSeq = parseInt(matches[1], 10) + 1;
      }
    }

    setInvoiceNo(`INV-SALE-${String(nextSeq).padStart(6, '0')}`);
    setSuccess('Ready for New Sale Entry');
  };

  const handleClearForm = () => {
    handleNewAdd(sales);
  };

  const loadSaleRecord = (p, { silent = false } = {}) => {
    if (!p) return;
    const pId = p.sale_id || p.id;
    setCurrentSaleId(pId);
    const invNo = p.sale_pos_no || p.invoice_no;

    if (silent) {
      setInvoiceSearchQuery('');
    } else {
      setInvoiceSearchQuery(invNo || '');
    }
    setInvoiceNo(invNo || '');

    setCustomerName(p.customer_name || '');
    setCustomerPhone(p.customer_phone || '');

    setSaleDate(p.sale_date || new Date().toISOString().split('T')[0]);
    setRemarks(p.remarks || '');
    setVatPercentage(String(p.vat_percentage ?? 0)); // VAT ডিফল্ট 0% (Default VAT: 0%) ৩ জায়গায় কারেকশন করতে হবে
    setDiscountType(p.discount_percentage > 0 ? 'Percentage' : 'Flat');
    setDiscountValue(
      String(p.discount_percentage > 0 ? p.discount_percentage : (p.discount_flat || p.discount_amount || ''))
    );

    const lastPayment = Array.isArray(p.payments) && p.payments.length > 0 ? p.payments[p.payments.length - 1] : null;
    setPaymentType(normalizePaymentType(lastPayment?.payment_type || p.payment_type));

    const totalPaid = Array.isArray(p.payments)
      ? p.payments.reduce((sum, pay) => sum + toSafeNumber(pay?.paid_amount), 0)
      : toSafeNumber(p.paid_amount, 0);
    setPaidAmount(String(totalPaid || ''));

    const rawItems = p.details || p.items || [];
    if (Array.isArray(rawItems)) {
  const loadedItems = rawItems.map((i) => {
  const qty = toSafeNumber(i?.quantity);
  const price = toSafeNumber(i?.sale_price);
  const prodInfo = i?.product || {};

  // Database-এর বর্তমান stock
  const currentStock = toSafeNumber(
    prodInfo.stock_qty ??
    prodInfo.current_stock ??
    prodInfo.stock,
    9999
  );
  const editableStock = currentStock + qty;

  return {

    product_id: i?.product_id,
    product_name: prodInfo.product_name || i?.product_name || 'Product',
    barcode: prodInfo.barcode || i?.barcode || '---',
    pack_size: getPackSizeName(
      prodInfo.pack_size_name,
      prodInfo.packSize,
      prodInfo.pack_size,
      i?.pack_size
    ),
    quantity: qty,
    original_quantity: qty,
    sale_price: price,
    subtotal: (qty * price).toFixed(2),
    stock: editableStock,
    current_stock: currentStock,
  };
  });

  setItems(loadedItems);
    } else {
      setItems([]);
    }

    // silent মোডে (নেভিগেশন বাটন) মেসেজ দেখানো হবে না, বাকি সব জায়গায় (নতুন লোড/সেভ/আপডেট) আগের মতোই দেখাবে
    if (silent) {
      setSuccess('');
      setError('');
    } else {
      setSuccess(`Loaded Invoice: ${invNo}`);
    }
  };

  const showLatestOrNew = (saleList) => {
    if (Array.isArray(saleList) && saleList.length > 0) {
      const sorted = [...saleList].sort((a, b) => (b.sale_id || b.id || 0) - (a.sale_id || a.id || 0));
      loadSaleRecord(sorted[0]);
    } else {
      handleNewAdd(saleList);
    }
  };

  const fetchData = async () => {
    try {
      const [prodRes, saleRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/products`, getAuthHeaders()).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_BASE_URL}/sales`, getAuthHeaders()).catch(() => ({ data: { data: [] } })),
      ]);

      const productData = prodRes.data.data || prodRes.data || [];
      const saleData = saleRes.data.data || saleRes.data || [];

      setProducts(Array.isArray(productData) ? productData : []);
      setSales(Array.isArray(saleData) ? saleData : []);

      return Array.isArray(saleData) ? saleData : [];
    } catch (err) {
      console.error('Error fetching data', err);
      setError('Failed to load data from server.');
      return [];
    }
  };

  // company_profiles টেবিল থেকে দোকানের তথ্য (নাম, ঠিকানা, ফোন, ইমেইল) আনার জন্য —
  // আগে এই ফাংশনটাই ছিল না, তাই প্রিন্টে সবসময় ডিফল্ট ডামি শপ-নাম দেখাত।
  const fetchShopInfo = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/company-profile`, getAuthHeaders());
      const raw = res.data?.data ?? res.data;
      // API কখনো array (রেকর্ড লিস্ট), কখনো সরাসরি object রিটার্ন করতে পারে — দুটোই নিরাপদে হ্যান্ডেল করা হচ্ছে
      const profile = Array.isArray(raw) ? raw[0] : raw;
      if (profile && typeof profile === 'object') {
        setShopInfo(profile);
      }
    } catch (err) {
      // ব্যর্থ হলেও অ্যাপ ক্র্যাশ করবে না; প্রিন্টে ডিফল্ট শপ তথ্য দেখাবে
      console.error('Failed to load company profile:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchData().then((saleData) => {
      if (!cancelled) showLatestOrNew(saleData);
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
      // Sale Date ইনপুট বা ক্যালেন্ডারের বাইরে ক্লিক করলে ক্যালেন্ডার বন্ধ হয়ে যাবে
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
      defaultDate: saleDate,
      allowInput: true,
      clickOpens: true,
      closeOnSelect: true,
      disableMobile: true,

      onChange: (selectedDates, dateStr) => {
        if (dateStr) {
          setSaleDate(dateStr);
        }
      },
    });
  }

  return () => {
    if (flatpickrInstanceRef.current) {
      flatpickrInstanceRef.current.destroy();
      flatpickrInstanceRef.current = null;
    }
  };

  // Flatpickr instance একবারই তৈরি হবে
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    if (flatpickrInstanceRef.current) {
      flatpickrInstanceRef.current.setDate(saleDate, false);
    }
  }, [saleDate]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleFirstRecord = () => {
    if (!sales || sales.length === 0) return;
    const sorted = [...sales].sort((a, b) => (a.sale_id || a.id || 0) - (b.sale_id || b.id || 0));
    loadSaleRecord(sorted[0], { silent: true });
  };

  const handlePrevRecord = () => {
    if (!sales || sales.length === 0) return;
    const sorted = [...sales].sort((a, b) => (a.sale_id || a.id || 0) - (b.sale_id || b.id || 0));
    let currentIndex = sorted.findIndex((p) => (p.sale_id || p.id) === currentSaleId);
    loadSaleRecord(currentIndex <= 0 ? sorted[0] : sorted[currentIndex - 1], { silent: true });
  };

  const handleNextRecord = () => {
    if (!sales || sales.length === 0) return;
    const sorted = [...sales].sort((a, b) => (a.sale_id || a.id || 0) - (b.sale_id || b.id || 0));
    let currentIndex = sorted.findIndex((p) => (p.sale_id || p.id) === currentSaleId);
    loadSaleRecord(currentIndex === -1 || currentIndex >= sorted.length - 1 ? sorted[sorted.length - 1] : sorted[currentIndex + 1], { silent: true });
  };

  const handleLastRecord = () => {
    if (!sales || sales.length === 0) return;
    const sorted = [...sales].sort((a, b) => (a.sale_id || a.id || 0) - (b.sale_id || b.id || 0));
    loadSaleRecord(sorted[sorted.length - 1], { silent: true });
  };

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

    if (currentStock <= 0) {
      setError(`Product "${productDisplayName}" is out of stock!`);
      return;
    }

    setItems((prevItems) => {
      const safePrevItems = Array.isArray(prevItems) ? prevItems : [];
      const existingIndex = safePrevItems.findIndex((item) => item.product_id === productId);
      const packSizeText = getPackSizeName(
        product.pack_size_name,
        product.packSize,
        product.pack_size
      );

      if (existingIndex > -1) {
        const nextQty = toSafeNumber(safePrevItems[existingIndex].quantity) + 1;

        if (nextQty > currentStock) {
          setError(`Cannot add more. Available stock is only ${currentStock}`);
          return safePrevItems;
        }

        const price = toSafeNumber(safePrevItems[existingIndex].sale_price);
        const newItems = [...safePrevItems];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: nextQty,
          subtotal: (nextQty * price).toFixed(2),
        };
        return newItems;
      }

      const price = Math.max(0, toSafeNumber(product.sale_price ?? product.price, 0));
      const newItem = {
        product_id: productId,
        product_name: productDisplayName,
        barcode: String(product.barcode || product.product_code || '---'),
        pack_size: packSizeText,
        quantity: 1,
        sale_price: price,
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
        if (isNaN(val) || val < 1) val = 1;
        const stock = toSafeNumber(newItems[index].stock, 9999);
        if (val > stock) {
          setError(`Quantity exceeds available stock (${stock})!`);
          val = stock > 0 ? stock : 1;
        } else {
          setError('');
        }
        newItems[index] = { ...newItems[index], quantity: val };
      } else if (field === 'sale_price') {
        if (isNaN(val) || val < 0) val = 0;
        newItems[index] = { ...newItems[index], sale_price: val };
      }

      const qty = toSafeNumber(newItems[index].quantity);
      const price = toSafeNumber(newItems[index].sale_price);
      newItems[index] = { ...newItems[index], subtotal: (qty * price).toFixed(2) };
      return newItems;
    });
  };

  const removeRow = (index) => {
    setItems((prevItems) => (Array.isArray(prevItems) ? prevItems.filter((_, i) => i !== index) : []));
  };

  const subtotalAmount = items.reduce((sum, item) => sum + toSafeNumber(item.subtotal), 0);
  const vatRate = Math.min(100, Math.max(0, toSafeNumber(vatPercentage)));
  const vatAmount = (subtotalAmount * vatRate) / 100;
  const subTotalWithVat = subtotalAmount + vatAmount;

  const rawDiscount = Math.max(0, toSafeNumber(discountValue));
  // ডিসকাউন্ট কখনো VAT-সহ সাবটোটালের চেয়ে বেশি দেখানো হবে না (নেগেটিভ পেয়েবল টোটাল ঠেকাতে)
  const calculatedDiscountAmount = Math.min(
    subTotalWithVat,
    discountType === 'Percentage' ? (subTotalWithVat * rawDiscount) / 100 : rawDiscount
  );

  const totalAmount = Math.max(0, subTotalWithVat - calculatedDiscountAmount).toFixed(2);

  // Paid Amount কখনো Payable Total-এর বেশি হতে পারবে না — বেশি দিলে
  // স্বয়ংক্রিয়ভাবে Payable Total-এর সমান হয়ে যাবে, এবং কখনো নেগেটিভ হবে না
  const numericPaid = Math.max(0, toSafeNumber(paidAmount));
  const finalPaidAmount = Math.min(numericPaid, toSafeNumber(totalAmount));
  const dueAmount = Math.max(0, toSafeNumber(totalAmount) - finalPaidAmount).toFixed(2);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (items.length === 0) {
      setError('Please add at least one product to the sale list!');
      return false;
    }

    // আপডেট করার সময় কনফার্মেশন পপআপ
    if (currentSaleId) {
      const isConfirmed = window.confirm("Are you sure you want to update this sale record?");
      if (!isConfirmed) {
        return false;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      customer_name: customerName.trim() || 'Walking Customer',
      customer_phone: customerPhone.trim() || '',
      sale_date: saleDate,
      vat_percentage: vatRate,
      discount_flat: discountType === 'Flat' ? rawDiscount : 0,
      discount_percentage: discountType === 'Percentage' ? rawDiscount : 0,
      remarks: remarks || '',
      items: items.map((i) => ({
        product_id: parseInt(i.product_id, 10),
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
        sale_price: Math.max(0, toSafeNumber(i.sale_price)),
      })),
      paid_amount: finalPaidAmount,
      payment_type: paymentType,
    };

    try {
      let savedSale;
      if (currentSaleId) {
        const res = await axios.put(`${API_BASE_URL}/sales/${currentSaleId}`, payload, getAuthHeaders());
        savedSale = res.data.data;
        setSuccess('Sale updated successfully!');
      } else {
        const res = await axios.post(`${API_BASE_URL}/sales`, payload, getAuthHeaders());
        savedSale = res.data.data;
        setSuccess('Sale recorded successfully!');
      }

      const updatedSales = await fetchData();
      if (savedSale) {
        loadSaleRecord(savedSale);
      } else {
        showLatestOrNew(updatedSales);
      }

      return true;
    } catch (err) {
      const validationErrors = err.response?.data?.errors;
      let errorMessage = err.response?.data?.message || err.response?.data?.error;
      if (validationErrors) {
        errorMessage = Object.values(validationErrors).flat().join(' ');
      }
      setError(errorMessage || 'Failed to save sale!');
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
    if (!currentSaleId) {
      setError('Please select an existing sale record to delete.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this sale record?')) return;

    try {
      setLoading(true);
      setError('');
      await axios.delete(`${API_BASE_URL}/sales/${currentSaleId}`, getAuthHeaders());
      setSuccess('Sale deleted successfully!');
      const updatedSales = await fetchData();
      showLatestOrNew(updatedSales);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete sale record.');
    } finally {
      setLoading(false);
    }
  };

  return (


    <div className="max-w-[1700px] mx-auto p-2 sm:p-4 bg-gray-50 min-h-screen text-gray-800">

    <style>{`

    /* Calendar Box */
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

    /* Month + Year */
    .flatpickr-calendar .flatpickr-current-month {
      color: #ffffff !important;
      font-size: 16px !important;
      font-weight: 400 !important;
      padding-top: 10px !important;
    }

    .flatpickr-calendar
    .flatpickr-current-month
    .cur-month {
      color: #ffffff !important;
      font-weight: 400 !important;
    }

    .flatpickr-calendar
    .flatpickr-current-month
    .cur-year {
      color: #ffffff !important;
      font-weight: 400 !important;
    }

    /* Month Dropdown */
    .flatpickr-calendar
    .flatpickr-current-month
    select.flatpickr-monthDropdown-months {
      background: #417690 !important;
      color: #ffffff !important;
      font-weight: 400 !important;
      border: none !important;
      outline: none !important;
    }

    .flatpickr-calendar
    .flatpickr-current-month
    select.flatpickr-monthDropdown-months option {
      background: #417690 !important;
      color: #ffffff !important;
      font-weight: 400 !important;
    }

    .flatpickr-calendar
    .flatpickr-current-month
    select.flatpickr-monthDropdown-months:hover,
    .flatpickr-calendar
    .flatpickr-current-month
    select.flatpickr-monthDropdown-months:focus {
      background: #417690 !important;
      color: #ffffff !important;
      outline: none !important;
    }

    .flatpickr-calendar
    .flatpickr-current-month
    select.flatpickr-monthDropdown-months option:checked {
      background: #417690 !important;
      color: #ffffff !important;
    }

    .flatpickr-calendar
    .flatpickr-months
    .flatpickr-prev-month,
    .flatpickr-calendar
    .flatpickr-months
    .flatpickr-next-month {
      color: #ffffff !important;
      fill: #ffffff !important;
      top: 0 !important;
      height: 54px !important;
      padding: 15px 12px !important;
    }

    .flatpickr-calendar
    .flatpickr-months
    .flatpickr-prev-month:hover,
    .flatpickr-calendar
    .flatpickr-months
    .flatpickr-next-month:hover {
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

    .flatpickr-calendar .flatpickr-days {
      background: #ffffff !important;
    }

    .flatpickr-calendar .dayContainer {
      background: #ffffff !important;
    }

    /* Normal Day */
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

    /* Selected Hover */
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

    /* If today selected */
    .flatpickr-calendar
    .flatpickr-day.today.selected {
      background: #417690 !important;
      border-color: #417690 !important;
      color: #ffffff !important;
    }

    .flatpickr-calendar
    .flatpickr-day.prevMonthDay,
    .flatpickr-calendar
    .flatpickr-day.nextMonthDay {
      color: #c8c8c8 !important;
    }

    .flatpickr-calendar
    .flatpickr-day.prevMonthDay:hover,
    .flatpickr-calendar
    .flatpickr-day.nextMonthDay:hover {
      background: #f5f8fa !important;
      border-color: #f5f8fa !important;
      color: #9ca3af !important;
    }

    .flatpickr-calendar
    .flatpickr-day.flatpickr-disabled {
      color: #d0d0d0 !important;
    }

    @media (max-width: 480px) {
      .flatpickr-calendar {
        width: 100% !important;
        max-width: 307px !important;
      }
    }

   `}
  </style>

      <Sale_print
        saleData={{
          sale_pos_no: invoiceNo,
          sale_date: saleDate,
          customer_name: customerName || 'Walking Customer',
          customer_phone: customerPhone,
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

      {/* প্রিন্টের সময় শুধু উপরের Sale_print (রিসিট) দেখাবে — নিচের পুরো
          সাধারণ স্ক্রিন-ভিউ ফর্ম UI প্রিন্টে লুকিয়ে যাবে (print:hidden) */}
      <div className="print:hidden">

      <div className="grid grid-cols-1 md:grid-cols-3 items-center mb-3 bg-[#417690] text-white px-3 py-1.5 rounded-lg shadow-sm gap-3">
        <div className="flex items-center">
          <h1 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap">
            🛍️ Sales / POS Form
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
              placeholder="Search by Invoice No..."
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
              {sales.filter((p) =>
                String(p.sale_pos_no || p.invoice_no || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase())
              ).length === 0 ? (
                <li className="px-3 py-2 text-xs text-gray-400">No invoice found</li>
              ) : (
                sales
                  .filter((p) =>
                    String(p.sale_pos_no || p.invoice_no || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase())
                  )
                  .map((p) => {
                    const invNo = p.sale_pos_no || p.invoice_no;
                    const custName = p.customer_name || 'Walking Customer';
                    const total = p.payable_amount || p.total_amount || 0;
                    return (
                      <li
                        key={p.sale_id || p.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          loadSaleRecord(p);
                          setShowInvoiceDropdown(false);
                        }}
                        className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 flex justify-between items-center"
                      >
                        <span className="font-mono font-bold text-[#417690]">{invNo}</span>
                        <span className="text-gray-500 text-[11px]">{custName} - ৳{total}</span>
                      </li>
                    );
                  })
              )}
            </ul>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-xs sm:text-sm font-semibold">{error}</div>}

      <form id="sale-form" onSubmit={handleSubmit}>
        <Sale_update
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          invoiceNo={invoiceNo}
          dateInputRef={dateInputRef}
          saleDate={saleDate}
          setSaleDate={setSaleDate}
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
                onClick={() => handleNewAdd(sales)}
                disabled={loading}
                className="bg-[#345e73] hover:hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>➕</span> New
              </button>

              <button
                type="submit"
                disabled={loading}
                className="bg-[#345e73] hover:bg-[#284a5b] text-white py-1 px-3 rounded text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                <span>💾</span> {currentSaleId ? 'Update Button' : 'Save Button'}
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
                disabled={!currentSaleId || loading}
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

            <Sale_arrow
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
                {/* টেবিল হেডার এখন সফটওয়্যারের ব্র্যান্ড কালারে — উপরের ৩টা সেকশন হেডারের সাথে মিল রেখে */}
                <tr className="bg-[#417690] text-white text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-3 text-center w-12 rounded-tl-lg">SL</th>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Barcode</th>
                  <th className="py-2 px-3">Pack Size</th>
                  <th className="py-2 px-3 text-center w-24">Qty</th>
                  <th className="py-2 px-3 text-right w-28">Sale Price (৳)</th>
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
                          value={item.sale_price}
                          onChange={(e) => handleItemChange(index, 'sale_price', e.target.value)}
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