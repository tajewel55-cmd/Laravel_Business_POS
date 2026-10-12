import React from 'react';

const safeLower = (value) => String(value ?? '').toLowerCase();

const getPackSize = (p) => {
  const raw = p?.pack_size_name || p?.packSize || p?.pack_size;
  if (!raw) return 'Pcs';
  if (typeof raw === 'string' && raw.trim() !== '') return raw;
  if (typeof raw === 'object' && raw.pack_size_name) return String(raw.pack_size_name);
  return 'Pcs';
};

const getStock = (p) => {
  const num = parseFloat(p?.stock_qty ?? p?.current_stock ?? p?.stock);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

function toDisplayPrice(value) {
  const num = parseFloat(value);
  return Number.isFinite(num) && num >= 0 ? num.toFixed(2) : '0.00';
}

const sanitizeNonNegativeInput = (value) => {
  if (value === '') return '';
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return '0';
  return value;
};

const SECTION_HEADER_CLASS =
  'text-xs font-bold text-white uppercase bg-[#417690] -mx-3 -mt-3 mb-2.5 px-3 py-1.5 rounded-t-lg';

export default function Purchase_update({
  // সাপ্লায়ার সার্চ ও নির্বাচন রিলেটেড প্রপস (Customer ফ্রি-টেক্সটের বদলে —
  // যেহেতু supplier_id একটা ফরেন-কী, তাই suppliers টেবিল থেকে বেছে নিতে হবে)
  supplierSearchRef,
  supplierSearchQuery,
  onSupplierSearchChange,
  showSupplierDropdown,
  setShowSupplierDropdown,
  suppliers,
  selectedSupplier,
  onSelectSupplier,

  invoiceNo,
  dateInputRef,
  purchaseDate,
  setPurchaseDate,
  remarks,
  setRemarks,

  globalSearchRef,
  globalProductSearch,
  setGlobalProductSearch,
  showGlobalDropdown,
  setShowGlobalDropdown,
  products,
  addProductToTable,

  subtotalAmount,
  vatPercentage,
  setVatPercentage,
  vatAmount,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  calculatedDiscountAmount,
  paymentType,
  setPaymentType,
  totalAmount,
  paidAmount,
  setPaidAmount,
  dueAmount,
}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const searchText = safeLower(globalProductSearch);

  const filteredProducts = searchText
    ? safeProducts.filter((p) => {
        if (!p) return false;
        const name = safeLower(p.product_name || p.name);
        const barcode = safeLower(p.barcode);
        return name.includes(searchText) || barcode.includes(searchText);
      })
    : [];

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const supplierSearchText = safeLower(supplierSearchQuery);
  const filteredSuppliers = supplierSearchText
    ? safeSuppliers.filter((s) => {
        if (!s) return false;
        const name = safeLower(s.supplier_name || s.name);
        const phone = safeLower(s.phone);
        return name.includes(supplierSearchText) || phone.includes(supplierSearchText);
      })
    : [];

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        try {
          addProductToTable(filteredProducts[0]);
        } catch (err) {
          console.error('Failed to add product:', err);
        }
      }
    } else if (e.key === 'Escape') {
      setShowGlobalDropdown(false);
    }
  };

  const handleSuggestionClick = (product) => {
    try {
      addProductToTable(product);
    } catch (err) {
      console.error('Failed to add product:', err);
    }
  };

  const handleSupplierKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuppliers.length > 0) {
        onSelectSupplier(filteredSuppliers[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSupplierDropdown(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 relative">

      {/* Left Column: Supplier & Invoice Info */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 space-y-2.5 relative">
        <h2 className={SECTION_HEADER_CLASS}>Supplier & Invoice Info</h2>

        <div className="flex items-center gap-2 relative" ref={supplierSearchRef}>
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0">
            Supplier
          </label>

          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search supplier by name/phone..."
              value={supplierSearchQuery || ''}
              onChange={(e) => {
                onSupplierSearchChange(e.target.value);
                setShowSupplierDropdown(true);
              }}
              onFocus={() => setShowSupplierDropdown(true)}
              onKeyDown={handleSupplierKeyDown}
              autoComplete="off"
              className="w-full px-2.5 py-1 text-xs border border-[#417690] rounded focus:outline-none focus:ring-1 focus:ring-[#417690]"
            />

            {showSupplierDropdown && supplierSearchText !== '' && (
              <ul className="absolute z-30 left-0 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg text-xs">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((s, idx) => {
                    const key = s.supplier_id ?? s.id ?? idx;
                    const name = s.supplier_name || s.name || 'Unnamed Supplier';
                    const phone = s.phone || '---';

                    return (
                      <li
                        key={key}
                        role="button"
                        tabIndex={0}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSelectSupplier(s);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectSupplier(s);
                          }
                        }}
                        className="px-3 py-2 hover:bg-[#417690] hover:text-white cursor-pointer border-b border-gray-100 outline-none group"
                      >
                        <p className="font-semibold text-gray-800 group-hover:text-white">{name}</p>
                        <p className="text-[10px] text-gray-500 font-mono group-hover:text-white">{phone}</p>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-3 py-2 text-gray-400 text-center">
                    No supplier found
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {selectedSupplier ? (
          <div className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1.5 space-y-0.5">
            <p><strong className="text-gray-700">Phone:</strong> {selectedSupplier.phone || 'N/A'}</p>
            <p><strong className="text-gray-700">Address:</strong> {selectedSupplier.address || 'N/A'}</p>
          </div>
        ) : (
          <p className="text-[10px] text-amber-600 font-semibold">⚠ Please select a supplier from the list above.</p>
        )}

        <div className="flex items-center gap-2">
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0">Purchase No</label>
          <input
            type="text"
            value={invoiceNo || ''}
            readOnly
            className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded bg-gray-100 font-mono text-gray-600"
          />
        </div>

        <div className="flex items-center gap-2 relative">
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0">Purchase Date</label>
          <input
            ref={dateInputRef}
            type="text"
            value={purchaseDate || ''}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full px-2.5 py-1 text-xs border border-[#417690] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#417690]"
          />
        </div>

        <div className="flex items-start gap-2">
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0 pt-1">Remarks</label>
          <textarea
            rows="2"
            value={remarks || ''}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional remarks..."
            className="w-full px-2.5 py-1 text-xs border border-[#417690] rounded resize-y min-h-10 focus:outline-none focus:ring-1 focus:ring-[#417690]"
          ></textarea>
        </div>
      </div>

      {/* Middle Column: Global Product Search & Barcode Scanner */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 space-y-3 relative">
        <h2 className={SECTION_HEADER_CLASS}>Product Search & Scan</h2>

        <div className="relative" ref={globalSearchRef}>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Search Product / Barcode</label>
          <input
            type="text"
            placeholder="Scan barcode or type product name..."
            value={globalProductSearch || ''}
            onChange={(e) => {
              setGlobalProductSearch(e.target.value);
              setShowGlobalDropdown(true);
            }}
            onFocus={() => setShowGlobalDropdown(true)}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
            className="w-full px-3 py-1.5 border-2 border-amber-500 rounded text-xs bg-white focus:outline-none focus:border-[#417690]"
          />
          {showGlobalDropdown && searchText !== '' && (
            <ul className="absolute z-30 left-0 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-56 overflow-y-auto shadow-lg text-xs">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p, idx) => {
                  const productKey = p.product_id ?? p.id ?? idx;
                  const displayName = p.product_name || p.name || 'Unnamed Product';
                  const displayBarcode = p.barcode || '---';
                  // Purchase ফর্মে রেফারেন্স প্রাইস হিসেবে প্রোডাক্টের নিজস্ব purchase_price (cost price) দেখানো হচ্ছে,
                  // sale_price নয় — কারণ আমরা এখানে পণ্য কিনছি, বিক্রি করছি না
                  const displayPrice = toDisplayPrice(p.purchase_price ?? p.sale_price ?? p.price);
                  const packSize = getPackSize(p);
                  const stock = getStock(p);
                  return (
                    <li
                      key={productKey}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick(p);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSuggestionClick(p);
                        }
                      }}
                      className="px-3 py-2 border-b border-gray-100 flex flex-col gap-0.5 outline-none cursor-pointer group hover:bg-[#417690]"
                    >
                      <p className="font-semibold text-gray-800 text-xs group-hover:text-white">{displayName}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono group-hover:text-white">
                        <div className="flex items-center gap-2.5">
                          <span className="group-hover:text-white">Barcode: {displayBarcode}</span>
                          <span>
                            <strong className="text-[#417690] group-hover:text-white">P:</strong> {packSize}
                          </span>
                          <span>
                            <strong className="text-[#417690] group-hover:text-white">S:</strong>{' '}
                            <span className="text-gray-600 group-hover:text-white">{stock}</span>
                          </span>
                        </div>
                        <span className="text-[#417690] font-bold text-xs whitespace-nowrap group-hover:text-white">৳{displayPrice}</span>
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-2 text-gray-400 text-center">No products found</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Right Column: Calculations & Payments */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 space-y-2 text-xs">
        <h2 className={SECTION_HEADER_CLASS}>Payment & Summary</h2>

        <div className="flex justify-between py-1 border-b border-gray-100">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-bold text-gray-800">৳{Number.isFinite(subtotalAmount) ? subtotalAmount.toFixed(2) : '0.00'}</span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-600">VAT (%):</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={vatPercentage || ''}
              onChange={(e) => setVatPercentage(sanitizeNonNegativeInput(e.target.value))}
              className="w-16 px-2 py-0.5 border border-[#417690] rounded text-right font-semibold focus:outline-none focus:ring-1 focus:ring-[#417690]"
            />
            <span className="font-bold text-gray-700">৳{Number.isFinite(vatAmount) ? vatAmount.toFixed(2) : '0.00'}</span>
          </div>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-gray-100">
          <span className="text-gray-600">Discount:</span>
          <div className="flex items-center gap-1">
            <select
              value={discountType || 'Flat'}
              onChange={(e) => setDiscountType(e.target.value)}
              className="px-1 py-0.5 border border-[#417690] rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-[#417690]"
            >
              <option value="Flat">Flat</option>
              <option value="Percentage">%</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discountValue || ''}
              onChange={(e) => setDiscountValue(sanitizeNonNegativeInput(e.target.value))}
              placeholder="0"
              className="w-16 px-2 py-0.5 border border-[#417690] rounded text-right font-semibold focus:outline-none focus:ring-1 focus:ring-[#417690]"
            />
            <span className="font-bold text-emerald-600 min-w-12.5 text-right">
              (-৳{Number.isFinite(calculatedDiscountAmount) ? calculatedDiscountAmount.toFixed(2) : '0.00'})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 items-center py-1 border-b border-gray-100 bg-gray-50 px-1 rounded">
          <div className="flex flex-col">
            <span className="text-gray-700 font-bold">Payable Total:</span>
            <span className="text-[#417690] font-bold text-sm">৳{totalAmount || '0.00'}</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-gray-600 font-semibold mb-0.5">Payment Type:</span>
            <select
              value={paymentType || 'Cash'}
              onChange={(e) => setPaymentType(e.target.value)}
              className="w-full px-2 py-0.5 border border-[#417690] rounded font-medium bg-white focus:outline-none focus:ring-1 focus:ring-[#417690]"
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="Mobile Banking">Mobile Banking</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-b border-gray-100 pb-2">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Paid Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              max={totalAmount || undefined}
              value={paidAmount || ''}
              onChange={(e) => setPaidAmount(sanitizeNonNegativeInput(e.target.value))}
              className="w-full px-2 py-1 border border-[#417690] rounded text-right font-bold text-emerald-600 text-xs focus:outline-none focus:ring-1 focus:ring-[#417690]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-red-600 mb-0.5">Due Amount</label>
            <div className="w-full px-2 py-1 border border-red-200 bg-red-50 rounded text-right font-bold text-red-600 text-xs">
              ৳{dueAmount || '0.00'}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}