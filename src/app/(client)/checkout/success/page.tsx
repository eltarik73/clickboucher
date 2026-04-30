// src/app/(client)/checkout/success/page.tsx
// Page de confirmation après paiement Stripe Checkout réussi.
// Le webhook checkout.session.completed est la source de vérité du PAID — cette page
// affiche juste une confirmation visuelle pour le client.
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  Receipt,
  Clock,
  MapPin,
  ArrowRight,
} from "lucide-react";

type OrderInfo = {
  id: string;
  orderNumber: string;
  displayNumber: string | null;
  totalCents: number;
  status: string;
  paidAt: string | null;
  estimatedReady: string | null;
  pickupSlotStart: string | null;
  shop: { name: string; address: string; city: string; phone: string | null };
  items: Array<{ name: string; quantity: number; weightGrams: number | null; totalCents: number }>;
};

function fmt(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError("Référence de commande manquante");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        setError("Impossible de charger la commande");
        return;
      }
      const json = await res.json();
      setOrder(json.data);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    // Re-poll once after 2s — le webhook Stripe peut prendre 1-2s pour confirmer le paiement
    const t = setTimeout(fetchOrder, 2000);
    return () => clearTimeout(t);
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f6f3] dark:bg-[#0a0a0a] gap-3 px-5">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Confirmation de votre commande…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f6f3] dark:bg-[#0a0a0a] gap-3 px-5">
        <p className="text-sm text-red-500">{error || "Commande introuvable"}</p>
        <Button onClick={() => router.push("/")} className="rounded-xl">
          Retour à l&apos;accueil
        </Button>
      </div>
    );
  }

  const isPaidConfirmed = !!order.paidAt;
  const isScheduled = !!order.pickupSlotStart;

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        {/* Hero */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-6 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {isPaidConfirmed ? "Paiement confirmé !" : "Commande envoyée !"}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isPaidConfirmed
                ? "Ta commande a bien été payée. Le boucher la prépare."
                : "Le paiement est en cours de confirmation. Tu recevras un email dans quelques secondes."}
            </p>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
              N° {order.displayNumber || order.orderNumber}
            </p>
          </CardContent>
        </Card>

        {/* Pickup info */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#DC2626]" />
              Retrait
            </h2>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">{order.shop.name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {order.shop.address}, {order.shop.city}
              </p>
              {order.shop.phone && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Tél : {order.shop.phone}
                </p>
              )}
            </div>
            {(isScheduled || order.estimatedReady) && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    {isScheduled ? "Retrait programmé à" : "Prête vers"}
                  </p>
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                    {fmtTime(isScheduled ? order.pickupSlotStart : order.estimatedReady)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order summary */}
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#DC2626]" />
              Détail
            </h2>
            <ul className="space-y-2 text-sm">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white truncate">
                      {item.quantity}× {item.name}
                    </p>
                    {item.weightGrams && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.weightGrams}g
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {fmt(item.totalCents)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-100 dark:border-white/10 pt-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Total</p>
              <p className="text-base font-bold text-[#DC2626]">{fmt(order.totalCents)}</p>
            </div>
          </CardContent>
        </Card>

        {/* CTAs */}
        <div className="space-y-2">
          <Link href={`/suivi/${order.id}`}>
            <Button className="w-full bg-[#DC2626] hover:bg-[#b91c1c] text-white h-11 rounded-xl">
              Suivre ma commande
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full h-11 rounded-xl">
              Retour à l&apos;accueil
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
