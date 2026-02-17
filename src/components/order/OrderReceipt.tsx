// src/components/order/OrderReceipt.tsx — Printable order receipt
"use client";

import { Printer } from "lucide-react";

type OrderItem = {
  name: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
  weightGrams?: number | null;
  unit?: string;
};

type Props = {
  orderNumber: string;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  customerName: string;
  items: OrderItem[];
  totalCents: number;
  commissionCents?: number;
  createdAt: string;
  estimatedReady?: string | null;
  customerNote?: string | null;
  paymentMethod?: string;
};

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function OrderReceipt({
  orderNumber, shopName, shopAddress, shopPhone,
  customerName, items, totalCents, commissionCents,
  createdAt, estimatedReady, customerNote, paymentMethod,
}: Props) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Print button (hidden on print) */}
      <button
        onClick={handlePrint}
        className="print:hidden mb-4 flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition text-sm"
      >
        <Printer className="w-4 h-4" />
        Imprimer
      </button>

      {/* Receipt */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl p-6 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="text-center mb-6 border-b border-dashed border-gray-300 dark:border-white/20 pb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{shopName}</h2>
          {shopAddress && <p className="text-xs text-gray-500 mt-1">{shopAddress}</p>}
          {shopPhone && <p className="text-xs text-gray-500">{shopPhone}</p>}
          <div className="mt-3 bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2 inline-block">
            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{orderNumber}</p>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
          <div>
            <span className="text-gray-400">Client:</span>
            <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{customerName}</span>
          </div>
          <div>
            <span className="text-gray-400">Date:</span>
            <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">{formatDate(createdAt)}</span>
          </div>
          {estimatedReady && (
            <div>
              <span className="text-gray-400">Retrait:</span>
              <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                ~{formatDate(estimatedReady)}
              </span>
            </div>
          )}
          {paymentMethod && (
            <div>
              <span className="text-gray-400">Paiement:</span>
              <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                {paymentMethod === "ONLINE" ? "En ligne" : "Au retrait"}
              </span>
            </div>
          )}
        </div>

        {customerNote && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              Note: {customerNote}
            </p>
          </div>
        )}

        {/* Items */}
        <div className="border-t border-dashed border-gray-300 dark:border-white/20 pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-white/5">
                <th className="text-left pb-2">Article</th>
                <th className="text-center pb-2">Qté</th>
                <th className="text-right pb-2">Prix</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                  <td className="py-2 text-gray-700 dark:text-gray-300">
                    {item.name}
                    {item.weightGrams && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({(item.weightGrams / 1000).toFixed(2)}kg)
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center text-gray-500">
                    {item.weightGrams ? "" : `×${item.quantity}`}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    {formatPrice(item.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="border-t-2 border-gray-900 dark:border-white mt-2 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900 dark:text-white">TOTAL</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatPrice(totalCents)}
            </span>
          </div>
          {commissionCents !== undefined && commissionCents > 0 && (
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Commission plateforme</span>
              <span>{formatPrice(commissionCents)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-300 dark:border-white/20">
          <p className="text-xs text-gray-400">Merci pour votre commande !</p>
          <p className="text-xs text-gray-400 mt-1">klikandgo.fr</p>
        </div>
      </div>
    </div>
  );
}
