"use client";

import { useRef } from "react";

interface TicketItem {
  name: string;
  quantity: number;
  unit: string;
  priceCents: number;
  totalCents: number;
  weightGrams?: number | null;
  vatRate: number;
}

interface TicketProps {
  order: {
    displayNumber: string;
    orderNumber: string;
    createdAt: string;
    customerName: string;
    customerNumber: string | null;
    customerNote: string | null;
    items: TicketItem[];
    totalCents: number;
    paymentMethod: string;
    estimatedReady: string | null;
  };
  shop: {
    name: string;
    address: string;
    city: string;
    siret: string | null;
    fullAddress: string | null;
    vatRate: number;
  };
  showQR?: boolean;
  qrUrl?: string;
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + "\u20AC";
}

function pad(s: string, len: number) {
  return s.length >= len ? s.substring(0, len) : s + " ".repeat(len - s.length);
}

function padLeft(s: string, len: number) {
  return s.length >= len ? s : " ".repeat(len - s.length) + s;
}

export default function OrderTicket({ order, shop, showQR, qrUrl }: TicketProps) {
  const ref = useRef<HTMLDivElement>(null);

  // VAT breakdown
  const vatGroups = new Map<number, { totalTTC: number }>();
  for (const item of order.items) {
    const rate = item.vatRate;
    const existing = vatGroups.get(rate) || { totalTTC: 0 };
    existing.totalTTC += item.totalCents;
    vatGroups.set(rate, existing);
  }

  const vatLines: { rate: number; ht: number; vat: number; ttc: number }[] = [];
  let totalHT = 0;
  let totalVAT = 0;

  vatGroups.forEach((v, rate) => {
    const ht = Math.round(v.totalTTC / (1 + rate / 100));
    const vat = v.totalTTC - ht;
    totalHT += ht;
    totalVAT += vat;
    vatLines.push({ rate, ht, vat, ttc: v.totalTTC });
  });

  const fmtDate = new Date(order.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const fmtTime = new Date(order.createdAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const estimatedTime = order.estimatedReady
    ? new Date(order.estimatedReady).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  function handlePrint() {
    const el = ref.current;
    if (!el) return;

    const win = window.open("", "_blank", "width=320,height=600");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html><head><style>
  @page { margin: 0; size: 80mm auto; }
  body { margin: 0; padding: 8px; font-family: "Courier New", monospace; font-size: 13px; width: 302px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 8px 0; }
  .line { display: flex; justify-content: space-between; }
  .big { font-size: 24px; font-weight: bold; }
  @media screen { .no-print { display: block; } }
  @media print { .no-print { display: none !important; } }
</style></head><body>
  ${el.innerHTML}
  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
</body></html>`);
    win.document.close();
  }

  const shopAddr = shop.fullAddress || `${shop.address}, ${shop.city}`;

  return (
    <div>
      {/* Print button (visible on screen only) */}
      <button
        onClick={handlePrint}
        className="mb-3 w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white font-bold min-h-[44px] py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-sm"
      >
        🖨 Imprimer le ticket
      </button>

      {/* Ticket content (hidden on screen, rendered for print) */}
      <div ref={ref} className="hidden">
        <div className="center bold" style={{ fontSize: "16px" }}>KLIK&GO</div>
        <div className="center bold">{shop.name}</div>
        <div className="center">{shopAddr}</div>
        {shop.siret && <div className="center">SIRET : {shop.siret}</div>}
        <div className="sep" />

        <div className="center big">{order.displayNumber}</div>
        <div className="center" style={{ marginTop: "4px" }}>{order.customerName}</div>
        {order.customerNumber && (
          <div className="center">Client {order.customerNumber}</div>
        )}
        <div className="center" style={{ marginTop: "4px" }}>
          {fmtDate} à {fmtTime}
        </div>
        <div className="sep" />

        {order.items.map((item, i) => {
          const qty =
            item.unit === "KG" && item.weightGrams
              ? `${(item.weightGrams / 1000).toFixed(1)}kg`
              : `${item.quantity}x`;
          const label = `${qty} ${item.name}`;
          const price = fmtPrice(item.totalCents);
          return (
            <div key={i} className="line">
              <span>{pad(label, 26)}</span>
              <span>{padLeft(price, 8)}</span>
            </div>
          );
        })}

        <div className="sep" />

        {vatLines.map((v, i) => (
          <div key={i}>
            <div className="line">
              <span>Sous-total HT ({v.rate}%)</span>
              <span>{fmtPrice(v.ht)}</span>
            </div>
            <div className="line">
              <span>TVA {v.rate}%</span>
              <span>{fmtPrice(v.vat)}</span>
            </div>
          </div>
        ))}

        <div className="sep" />
        <div className="line bold">
          <span>TOTAL TTC</span>
          <span>{fmtPrice(order.totalCents)}</span>
        </div>
        <div className="sep" />

        <div>Paiement : {order.paymentMethod === "ONLINE" ? "En ligne" : "Sur place"}</div>
        {estimatedTime && <div>Retrait estimé : {estimatedTime}</div>}
        {order.customerNote && (
          <div style={{ marginTop: "4px" }}>Note : {order.customerNote}</div>
        )}

        {showQR && qrUrl && (
          <div className="center" style={{ marginTop: "8px" }}>
            <img src={qrUrl} alt="QR" style={{ width: "120px", height: "120px", margin: "0 auto" }} />
          </div>
        )}

        <div className="sep" />
        <div className="center">Merci de votre visite !</div>
        <div className="center">www.klikgo.app</div>
      </div>
    </div>
  );
}
