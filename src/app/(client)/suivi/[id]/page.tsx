"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Clock, Package, Check, AlertTriangle, Navigation, MessageCircle, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { formatPrice } from "@/lib/utils";

const MOCK_ORDER = {
  id: "order-1",
  orderNumber: "CB-20240615-001",
  status: "PREPARING" as string,
  shop: { name: "Boucherie Savoie Tradition", address: "12 Rue de Boigne, Chambéry", phone: "04 79 33 12 34" },
  items: [
    { id: "i1", name: "Entrecôte", quantity: 2, unit: "KG", requestedWeight: 500, unitPriceCents: 3200, totalPriceCents: 3200 },
    { id: "i2", name: "Merguez maison", quantity: 1, unit: "BARQUETTE", unitPriceCents: 890, totalPriceCents: 890 },
  ],
  totalCents: 4090,
  paymentMethod: "CB_ONLINE",
  estimatedReadyAt: new Date(Date.now() + 12 * 60_000).toISOString(),
  slot: "18:10 – 18:25",
};

const STEPS = [
  { key: "PENDING", label: "Commande reçue", icon: Check },
  { key: "ACCEPTED", label: "Acceptée", icon: Check },
  { key: "PREPARING", label: "En préparation", icon: Package },
  { key: "WEIGHING", label: "Contrôle poids", icon: Package },
  { key: "READY", label: "Prête", icon: Package },
  { key: "COLLECTED", label: "Retirée", icon: Check },
];

const STATUS_INDEX: Record<string, number> = {
  PENDING: 0, ACCEPTED: 1, PREPARING: 2, WEIGHING: 3, WEIGHT_REVIEW: 3, READY: 4, COLLECTED: 5, CANCELLED: -1,
};

export default function SuiviPage({ params }: { params: { id: string } }) {
  const order = MOCK_ORDER;
  const currentIdx = STATUS_INDEX[order.status] ?? 0;
  const minutesLeft = Math.max(0, Math.round((new Date(order.estimatedReadyAt).getTime() - Date.now()) / 60_000));
  const isReady = order.status === "READY" || order.status === "COLLECTED";
  const needsValidation = order.status === "WEIGHT_REVIEW";

  return (
    <PageContainer>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-zinc-100">
        <div className="flex items-center gap-3 h-14 px-4">
          <Link href="/commandes" className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-100 tap-scale">
            <ArrowLeft size={17} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold">Commande #{order.orderNumber.split("-").pop()}</h1>
            <p className="text-[11px] text-zinc-400">Retrait {order.slot}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* Status card */}
        <div className="rounded-3xl bg-zinc-50 border border-zinc-100 p-5 text-center">
          <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${isReady ? "bg-green-100" : needsValidation ? "bg-red-100" : "bg-primary/10"}`}>
            {isReady ? <Check size={24} className="text-green-600" /> : needsValidation ? <AlertTriangle size={24} className="text-red-500" /> : <Clock size={24} className="text-primary" />}
          </div>
          <h2 className="text-lg font-bold">
            {isReady ? "Prête !" : needsValidation ? "Accord requis" : "En préparation"}
          </h2>
          {!isReady && !needsValidation && minutesLeft > 0 && (
            <p className="text-[13px] text-zinc-500 mt-1 flex items-center justify-center gap-1">
              <Clock size={13} />Prête dans ~{minutesLeft} min
            </p>
          )}
        </div>

        {/* Validation block */}
        {needsValidation && (
          <div className="rounded-2xl bg-red-50 border border-red-200/50 p-4 space-y-3">
            <p className="text-[13px] text-red-700 font-semibold">Le poids dépasse +10%. Validation requise.</p>
            <div className="flex gap-2">
              <button className="flex-1 py-2.5 rounded-full bg-primary text-white text-[12px] font-semibold tap-scale">Valider</button>
              <button className="flex-1 py-2.5 rounded-full bg-white text-zinc-700 text-[12px] font-semibold border border-zinc-200 tap-scale">Refuser (ajuster)</button>
            </div>
          </div>
        )}

        {/* Action pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <a href={`https://maps.google.com/maps?q=${encodeURIComponent(order.shop.address)}`} target="_blank" className="chip flex items-center gap-1.5">
            <Navigation size={12} />Itinéraire
          </a>
          <a href={`tel:${order.shop.phone}`} className="chip flex items-center gap-1.5">
            <Phone size={12} />Appeler
          </a>
          <a href={`https://wa.me/33${order.shop.phone.replace(/\D/g, "").slice(1)}`} target="_blank" className="chip flex items-center gap-1.5">
            <MessageCircle size={12} />WhatsApp
          </a>
        </div>

        {/* Timeline */}
        <div className="rounded-3xl bg-white border border-zinc-100 p-5">
          <h3 className="text-[13px] font-bold mb-4">Suivi</h3>
          <div className="space-y-0">
            {STEPS.map((s, i) => {
              const isDone = i <= currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={s.key} className="flex gap-3">
                  {/* Line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 ${isDone ? "bg-primary border-primary" : "bg-white border-zinc-300"} ${isCurrent ? "ring-4 ring-primary/15" : ""}`} />
                    {i < STEPS.length - 1 && <div className={`w-0.5 h-8 ${isDone ? "bg-primary" : "bg-zinc-200"}`} />}
                  </div>
                  {/* Label */}
                  <div className="pb-6">
                    <span className={`text-[13px] font-medium ${isDone ? "text-zinc-900" : "text-zinc-400"} ${isCurrent ? "font-bold" : ""}`}>
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shop info */}
        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 space-y-2">
          <h3 className="text-[13px] font-bold">{order.shop.name}</h3>
          <p className="flex items-center gap-1.5 text-[12px] text-zinc-500"><MapPin size={12} />{order.shop.address}</p>
          <p className="flex items-center gap-1.5 text-[12px] text-zinc-500"><Phone size={12} />{order.shop.phone}</p>
        </div>

        {/* Items */}
        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
          <h3 className="text-[13px] font-bold mb-2.5">Articles</h3>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-[12px] py-1.5">
              <div>
                <span className="text-zinc-700">{item.name}</span>
                <span className="text-zinc-400 ml-1">×{item.quantity}</span>
                {item.unit === "KG" && item.requestedWeight && (
                  <span className="text-[10px] text-zinc-400 ml-1">({item.requestedWeight}g)</span>
                )}
              </div>
              <span className="font-semibold">{formatPrice(item.totalPriceCents)}</span>
            </div>
          ))}
          <div className="border-t border-zinc-200 pt-2 mt-2 flex justify-between">
            <span className="text-[13px] font-bold">Total</span>
            <span className="text-[13px] font-extrabold">{formatPrice(order.totalCents)}</span>
          </div>
        </div>

        {/* Reorder */}
        {order.status === "COLLECTED" && (
          <button className="w-full py-3.5 rounded-full bg-primary text-white text-[13px] font-semibold tap-scale flex items-center justify-center gap-2 shadow-md shadow-primary/20">
            <RotateCcw size={15} />Recommander cette commande
          </button>
        )}
      </div>
    </PageContainer>
  );
}
