import React from 'react';

// সবসময় একটা নিরাপদ, non-negative সংখ্যা রিটার্ন করবে, কখনো NaN রিটার্ন করবে না
const toSafeNumber = (value, fallback = 0) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? Math.max(0, num) : fallback;
};

// যেকোনো ভ্যালুকে নিরাপদে একটা প্লেইন টেক্সট স্ট্রিং বানায়
const safeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return fallback;
  const text = String(value).trim();
  return text !== '' ? text : fallback;
};

export default function Adjustment_print({ adjustmentData, shopInfo }) {
  if (!adjustmentData) return null;

  const companyName = safeText(shopInfo?.company_name, 'USL Pharmacy & POS');
  const companyAddress = safeText(shopInfo?.address, 'Main Road, City Center');
  const companyMobile = safeText(shopInfo?.mobile, '');
  const companyMail = safeText(shopInfo?.mail, '');

  const rawItems = adjustmentData.details || adjustmentData.items || [];
  const items = Array.isArray(rawItems) ? rawItems : [];

  const totalQty = items.reduce((sum, i) => sum + toSafeNumber(i?.quantity), 0);
  const totalValue = items.reduce((sum, i) => {
    const qty = toSafeNumber(i?.quantity);
    const price = toSafeNumber(i?.purchase_price);
    return sum + qty * price;
  }, 0);

  const type = safeText(adjustmentData.type, 'IN');
  const printedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="hidden print:block" id="pos-print-adjustment-receipt">
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
          }
          body * {
            visibility: hidden;
          }
          #pos-print-adjustment-receipt,
          #pos-print-adjustment-receipt * {
            visibility: visible;
          }
          #pos-print-adjustment-receipt {
            position: absolute;
            top: 0;
            left: 0;
            width: 80mm;
          }
        }
      `}</style>

      <div className="bg-white text-black font-mono text-[11px] leading-tight w-[80mm] mx-auto p-2 box-border">

        <div className="text-center mb-1.5">
          <h1 className="text-[14px] font-bold uppercase leading-snug">{companyName}</h1>
          {companyAddress && <p className="text-[10px] leading-snug">{companyAddress}</p>}
          {(companyMobile || companyMail) && (
            <p className="text-[10px] leading-snug">
              {companyMobile && <span>Tel: {companyMobile}</span>}
              {companyMobile && companyMail ? ' | ' : ''}
              {companyMail && <span>{companyMail}</span>}
            </p>
          )}
        </div>

        <div className="border-t border-dashed border-black my-1"></div>

        <div className="text-center mb-1">
          <p className="text-[12px] font-bold tracking-wide">
            STOCK ADJUSTMENT ({type === 'IN' ? 'STOCK IN' : 'STOCK OUT'})
          </p>
        </div>

        <div className="text-[10px] space-y-0.5 mb-1">
          <div className="flex justify-between">
            <span>Adj. No:</span>
            <span className="font-bold">{safeText(adjustmentData.adj_invoice_no, '-')}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{safeText(adjustmentData.adjustment_date, '-')}</span>
          </div>
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="font-bold">{type}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-1"></div>

        {items.length === 0 ? (
          <p className="text-center text-gray-500 py-2">No items</p>
        ) : (
          <div>
            {items.map((item, index) => {
              const qty = toSafeNumber(item?.quantity);
              const price = toSafeNumber(item?.purchase_price);
              const prodName = safeText(
                item?.product?.product_name || item?.product?.name || item?.product_name,
                'Product'
              );
              return (
                <div key={item?.product_id ?? index} className="flex justify-between gap-2 mb-0.5">
                  <span className="flex-1 min-w-0 break-words leading-snug">
                    {index + 1}. {prodName} ({qty} x ৳{price.toFixed(2)})
                  </span>
                  <span className="font-bold shrink-0 whitespace-nowrap">৳{(qty * price).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-dashed border-black my-1"></div>

        <div className="space-y-0.5">
          <div className="flex justify-between font-bold">
            <span>Total Quantity:</span>
            <span>{totalQty}</span>
          </div>
          <div className="flex justify-between text-[13px] font-bold">
            <span>Total Value:</span>
            <span>৳{totalValue.toFixed(2)}</span>
          </div>
        </div>

        {safeText(adjustmentData.remarks) && (
          <>
            <div className="border-t border-dashed border-black my-1"></div>
            <div className="text-[10px]">
              <span className="font-bold">Note:</span> {safeText(adjustmentData.remarks)}
            </div>
          </>
        )}

        <div className="border-t border-dashed border-black my-1"></div>

        <div className="text-center text-[10px] mt-1.5 space-y-0.5">
          <p className="font-bold">Stock adjustment recorded in system.</p>
          <p className="text-gray-500">Printed: {printedAt}</p>
        </div>
      </div>
    </div>
  );
}