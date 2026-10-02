import React from 'react';

export default function Purchase_arrow({ onFirst, onPrev, onNext, onLast, disabled }) {
  return (
    <div className="flex items-center gap-1 bg-white/10 p-1 rounded">
      <button
        type="button"
        onClick={onFirst}
        disabled={disabled}
        title="First Record"
        className="bg-[#284a5b] hover:bg-[#1d3542] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50"
      >
        ⏮ First
      </button>

      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        title="Previous Record"
        className="bg-[#284a5b] hover:bg-[#1d3542] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50"
      >
        ◀ Prev
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        title="Next Record"
        className="bg-[#284a5b] hover:bg-[#1d3542] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50"
      >
        Next ▶
      </button>

      <button
        type="button"
        onClick={onLast}
        disabled={disabled}
        title="Last Record"
        className="bg-[#284a5b] hover:bg-[#1d3542] text-white px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50"
      >
        Last ⏭
      </button>
    </div>
  );
}