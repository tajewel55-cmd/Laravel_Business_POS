import React from 'react';

// সবসময় একটা নিরাপদ, non-negative সংখ্যা রিটার্ন করবে, কখনো NaN রিটার্ন করবে না
const toSafeNumber = (value, fallback = 0) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? Math.max(0, num) : fallback;
};

// যেকোনো ভ্যালুকে নিরাপদে একটা প্লেইন টেক্সট স্ট্রিং বানায় —
// company_profiles থেকে আসা ফিল্ড কখনো null/undefined/অন্য টাইপ হলেও ক্র্যাশ করবে না
const safeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return fallback; // ভুলবশত object এলে যেন সরাসরি রেন্ডার না হয়
  const text = String(value).trim();
  return text !== '' ? text : fallback;
};

// দশমিক বিয়োগ/গোলাকার সমস্যার কারণে "0.00" এর বদলে "0.0000001" এর মতো মান
// VAT/Discount হিসেবে দেখানো এড়াতে একটা ছোট এপসিলন থ্রেশহোল্ড ব্যবহার করা হয়েছে
const isMeaningfulAmount = (value) => toSafeNumber(value) > 0.004;

export default function Sale_print({ saleData, shopInfo }) {
  if (!saleData) return null;

  // company_profiles টেবিল থেকে আসা কোম্পানির তথ্য —
  // (profile_id, company_name, mobile, mail, address, created_at, updated_at)
  const companyName = safeText(shopInfo?.company_name, 'USL Pharmacy & POS');
  const companyAddress = safeText(shopInfo?.address, 'Main Road, City Center');
  const companyMobile = safeText(shopInfo?.mobile, '');
  const companyMail = safeText(shopInfo?.mail, '');

  const rawItems = saleData.details || saleData.items || [];
  const items = Array.isArray(rawItems) ? rawItems : [];

  const subtotal = items.reduce((sum, i) => {
    const qty = toSafeNumber(i?.quantity);
    const price = toSafeNumber(i?.sale_price);
    return sum + qty * price;
  }, 0);

  const totalQty = items.reduce((sum, i) => sum + toSafeNumber(i?.quantity), 0);

  const vatPercentage = toSafeNumber(saleData.vat_percentage);
  const vat = saleData.vat_amount !== undefined && saleData.vat_amount !== null
    ? toSafeNumber(saleData.vat_amount)
    : (subtotal * vatPercentage) / 100;

  const discount = Math.min(
    subtotal + vat,
    toSafeNumber(saleData.discount_flat, toSafeNumber(saleData.discount_amount, 0))
  );

  const total = saleData.payable_amount !== undefined && saleData.payable_amount !== null
    ? toSafeNumber(saleData.payable_amount)
    : Math.max(0, (saleData.total_amount !== undefined && saleData.total_amount !== null
      ? toSafeNumber(saleData.total_amount)
      : subtotal + vat) - discount);

  // পেইড অ্যামাউন্ট কখনো Total-এর বেশি দেখানো হবে না (প্রিন্টেও যেন হিসাব সঠিক থাকে)
  const paid = Math.min(toSafeNumber(saleData.paid_amount, 0), total);
  const due = Math.max(0, total - paid);

  const showVat = isMeaningfulAmount(vat);
  const showDiscount = isMeaningfulAmount(discount);

  const paymentStatus = due <= 0.004 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'DUE');
  const printedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="hidden print:block" id="pos-print-receipt">
      {/*
        প্রিন্টের সময় শুধু এই রিসিটটাই দেখানোর জন্য —
        আগে শুধু এই কম্পোনেন্টে "print:block" ক্লাস ছিল, কিন্তু বাকি পুরো পেজ (ফর্ম, বাটন, ইনভয়েস
        সার্চ ইত্যাদি) hide করার কোনো নিয়ম ছিল না — তাই প্রিন্ট করলে A4-এর মতো পুরো পেজ প্রিন্ট হয়ে
        যাচ্ছিল। এখন body-এর সবকিছু visibility:hidden করে শুধু #pos-print-receipt-কে visible ও
        পেজের একদম উপরে-বামে বসিয়ে দেওয়া হচ্ছে, যাতে সত্যিকারের ৮০mm POS রিসিটের মতো প্রিন্ট হয়।
      */}
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
          #pos-print-receipt,
          #pos-print-receipt * {
            visibility: visible;
          }
          #pos-print-receipt {
            position: absolute;
            top: 0;
            left: 0;
            width: 80mm;
          }
        }
      `}</style>

      <div className="bg-white text-black font-mono text-[11px] leading-tight w-[80mm] mx-auto p-2 box-border">

        {/* Shop Header — company_profiles টেবিল থেকে আসা তথ্য */}
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
          <p className="text-[12px] font-bold tracking-wide">CASH MEMO</p>
        </div>

        {/* Invoice Meta */}
        <div className="text-[10px] space-y-0.5 mb-1">
          <div className="flex justify-between">
            <span>Invoice:</span>
            <span className="font-bold">{safeText(saleData.sale_pos_no || saleData.invoice_no, '-')}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{safeText(saleData.sale_date, '-')}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="text-right">{safeText(saleData.customer_name, 'Walking Customer')}</span>
          </div>
          {safeText(saleData.customer_phone) && (
            <div className="flex justify-between">
              <span>Phone:</span>
              <span>{safeText(saleData.customer_phone)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-black my-1"></div>

        {/* Items */}
        {items.length === 0 ? (
          <p className="text-center text-gray-500 py-2">No items</p>
        ) : (
          <div>
            {items.map((item, index) => {
              const qty = toSafeNumber(item?.quantity);
              const price = toSafeNumber(item?.sale_price);
              const prodName = safeText(
                item?.product?.product_name || item?.product?.name || item?.product_name,
                'Product'
              );
              return (
                <div key={item?.product_id ?? index} className="flex justify-between gap-2 mb-0.5">
                  <span className="flex-1 min-w-0 wrap-break-word leading-snug">
                    {index + 1}. {prodName} ({qty} x ৳{price.toFixed(2)})
                  </span>
                  <span className="font-bold shrink-0 whitespace-nowrap">৳{(qty * price).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-dashed border-black my-1"></div>

        {/* Summary Calculations — VAT ও Discount থাকলেই শুধু দেখাবে */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>৳{subtotal.toFixed(2)}</span>
          </div>

          {showVat && (
            <div className="flex justify-between">
              <span>VAT ({vatPercentage}%):</span>
              <span>৳{vat.toFixed(2)}</span>
            </div>
          )}

          {showDiscount && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-৳{discount.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-black my-1"></div>

        <div className="flex justify-between text-[13px] font-bold mb-1">
          <span>TOTAL:</span>
          <span>৳{total.toFixed(2)}</span>
        </div>

        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>Payment ({safeText(saleData.payment_type, 'Cash')}):</span>
            <span>৳{paid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Due:</span>
            <span>৳{due.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="font-bold tracking-wide">{paymentStatus}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-1"></div>

        <div className="text-[10px] flex justify-between mb-1">
          <span>Total Items:</span>
          <span>{items.length} ({totalQty} qty)</span>
        </div>

        <div className="border-t border-dashed border-black my-1"></div>

        {/* Footer */}
        <div className="text-center text-[10px] mt-1.5 space-y-0.5">
          <p className="font-bold">ধন্যবাদ! আবার আসবেন।</p>
          <p>Thank you for shopping with us!</p>
          <p className="text-gray-500">Printed: {printedAt}</p>
        </div>
      </div>
    </div>
  );
}