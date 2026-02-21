"use client";

import Link from "next/link";

interface TicketItem {
  name: string;
  quantity: number;
  unit: string;
  totalCents: number;
  weightGrams?: number | null;
}

interface TicketData {
  orderId: string;
  displayNumber: string;
  customerFirstName: string;
  customerNumber: string | null;
  items: TicketItem[];
  totalCents: number;
  shopName: string;
  prepTimeMin: number;
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtQty(item: TicketItem) {
  if (item.unit === "KG" && item.weightGrams) {
    return `${(item.weightGrams / 1000).toFixed(1).replace(".", ",")} kg`;
  }
  return `${item.quantity}x`;
}

export function OrderTicketBubble({ data }: { data: TicketData }) {
  return (
    <div
      className="w-full max-w-[300px] rounded-2xl overflow-hidden"
      style={{
        background: "#fff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 text-center">
        <p className="text-xs font-semibold text-emerald-600 mb-2">✅ Commande confirmée</p>
        <div
          className="text-[40px] font-black text-[#DC2626] leading-none tracking-tight"
        >
          {data.displayNumber}
        </div>
        <div className="mt-1.5 text-[20px] font-bold text-gray-900 leading-tight">
          {data.customerFirstName}
        </div>
        {data.customerNumber && (
          <div className="mt-0.5 text-[13px] text-gray-400">
            Client {data.customerNumber}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="mx-5 h-px bg-[#F0F0F0]" />

      {/* Items */}
      <div className="px-5 py-3 space-y-1.5">
        {data.items.map((item, i) => (
          <div key={i} className="flex justify-between text-[13px]">
            <span className="text-gray-700">
              {fmtQty(item)} {item.name}
            </span>
            <span className="font-semibold text-gray-900 shrink-0 ml-2">
              {fmtPrice(item.totalCents)}
            </span>
          </div>
        ))}
      </div>

      {/* Separator + Total */}
      <div className="mx-5 h-px bg-[#F0F0F0]" />
      <div className="px-5 py-2.5 flex justify-between">
        <span className="text-[13px] font-bold text-gray-900">Total</span>
        <span className="text-[15px] font-extrabold text-gray-900">
          {fmtPrice(data.totalCents)}
        </span>
      </div>

      {/* Shop + time */}
      <div className="px-5 py-2.5 bg-[#FAFAFA] space-y-1">
        <p className="text-[12px] text-gray-500">
          📍 {data.shopName}
        </p>
        <p className="text-[12px] text-gray-500">
          🕐 Retrait estimé : {data.prepTimeMin} min
        </p>
      </div>

      {/* CTA */}
      <div className="p-4 pt-3">
        <Link
          href={`/suivi/${data.orderId}`}
          className="block w-full text-center bg-[#DC2626] text-white text-sm font-bold py-3 rounded-xl hover:bg-[#b91c1c] transition-colors"
        >
          📋 Suivre ma commande
        </Link>
      </div>
    </div>
  );
}
