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

export default function Adjustment_update({
  type,
  setType,
  invoiceNo,
  dateInputRef,
  adjustmentDate,
  setAdjustmentDate,
  remarks,
  setRemarks,

  globalSearchRef,
  globalProductSearch,
  setGlobalProductSearch,
  showGlobalDropdown,
  setShowGlobalDropdown,
  products,
  addProductToTable,

  totalQty,
  totalValue,
}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const searchText = safeLower(globalProductSearch);

  const filteredProducts = searchText
    ? safeProducts.filter((p) => {
        if (!p) return false;
        const name = safeLower(p.product_name || p.name);
        const code = safeLower(p.barcode || p.product_code);
        return name.includes(searchText) || code.includes(searchText);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 relative">

      {/* Left Column: Type & Invoice Info */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 space-y-2.5 relative">
        <h2 className={SECTION_HEADER_CLASS}>Adjustment & Invoice Info</h2>

        <div className="flex items-center gap-2">
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0">Type *</label>
          <div className="w-full grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('IN')}
              className="py-2 rounded text-xs font-bold border-2 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
              style={
                type === 'IN'
                  ? { background: '#059669', borderColor: '#059669', color: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }
                  : { background: '#ffffff', borderColor: '#6ee7b7', color: '#047857' }
              }
            >
              <span>⬆</span>
              <span>Stock IN</span>
            </button>
            <button
              type="button"
              onClick={() => setType('OUT')}
              className="py-2 rounded text-xs font-bold border-2 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
              style={
                type === 'OUT'
                  ? { background: '#dc2626', borderColor: '#dc2626', color: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }
                  : { background: '#ffffff', borderColor: '#fca5a5', color: '#b91c1c' }
              }
            >
              <span>⬇</span>
              <span>Stock OUT</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0">Adj. No</label>
          <input
            type="text"
            value={invoiceNo || ''}
            readOnly
            className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded bg-gray-100 font-mono text-gray-600"
          />
        </div>

        <div className="flex items-center gap-2 relative">
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0">Adj. Date</label>
          <input
            ref={dateInputRef}
            type="text"
            value={adjustmentDate || ''}
            onChange={(e) => setAdjustmentDate(e.target.value)}
            className="w-full px-2.5 py-1 text-xs border border-[#417690] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#417690]"
          />
        </div>

        <div className="flex items-start gap-2">
          <label className="w-24 text-[11px] font-semibold text-gray-600 shrink-0 pt-1">Remarks</label>
          <textarea
            rows="3"
            value={remarks || ''}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Reason for adjustment..."
            className="w-full px-2.5 py-1 text-xs border border-[#417690] rounded resize-y min-h-16 focus:outline-none focus:ring-1 focus:ring-[#417690]"
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
                  const displayCode = p.barcode || p.product_code || '---';
                  const displayPrice = toDisplayPrice(p.purchase_price ?? p.sale_price ?? p.price);
                  const packSize = getPackSize(p);
                  const stock = getStock(p);
                  const outOfStock = stock <= 0;
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
                          <span className="group-hover:text-white">Code: {displayCode}</span>
                          <span>
                            <strong className="text-[#417690] group-hover:text-white">P:</strong> {packSize}
                          </span>
                          <span>
                            <strong className="text-[#417690] group-hover:text-white">S:</strong>{' '}
                            <span className={outOfStock ? 'text-red-500 font-bold group-hover:text-white' : 'text-gray-600 group-hover:text-white'}>
                              {stock}
                            </span>
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

        <p className="text-[10px] text-gray-500 leading-snug">
          {type === 'OUT'
            ? '⚠ Stock OUT: quantity cannot exceed the product\'s current available stock.'
            : 'Stock IN: adds the entered quantity straight to inventory, no upper limit.'}
        </p>
      </div>

      {/* Right Column: Summary */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 space-y-2 text-xs">
        <h2 className={SECTION_HEADER_CLASS}>Summary</h2>

        <div className="flex justify-between py-1 border-b border-gray-100">
          <span className="text-gray-600">Total Quantity:</span>
          <span className="font-bold text-gray-800">{Number.isFinite(totalQty) ? totalQty : 0}</span>
        </div>

        <div className="flex justify-between py-1 border-b border-gray-100 bg-gray-50 px-1 rounded font-bold">
          <span className="text-gray-700">Total Value:</span>
          <span className="text-[#417690]">৳{Number.isFinite(totalValue) ? totalValue.toFixed(2) : '0.00'}</span>
        </div>

        <div
          className="mt-2 p-2 rounded text-[11px] font-semibold text-center"
          style={
            type === 'IN'
              ? { background: '#ecfdf5', color: '#047857' }
              : { background: '#fef2f2', color: '#b91c1c' }
          }
        >
          {type === 'IN' ? '⬆ This will INCREASE stock for the items below.' : '⬇ This will DECREASE stock for the items below.'}
        </div>
      </div>

    </div>
  );
}