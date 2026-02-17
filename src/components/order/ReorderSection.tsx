// src/components/order/ReorderSection.tsx — Reorder + recurring buttons for completed orders
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CalendarClock, X, Loader2 } from "lucide-react";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

type Props = {
  orderId: string;
  shopName: string;
};

export default function ReorderSection({ orderId, shopName }: Props) {
  const router = useRouter();
  const [reordering, setReordering] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReorder = useCallback(async () => {
    setReordering(true);
    setMessage(null);
    try {
      const res = await fetch("/api/orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error?.message || "Erreur lors de la recommande");
        return;
      }
      const newOrder = json.data?.order;
      if (json.data?.message) {
        setMessage(json.data.message);
      }
      if (newOrder?.id) {
        setTimeout(() => router.push(`/suivi/${newOrder.id}`), 1500);
      }
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setReordering(false);
    }
  }, [orderId, router]);

  const handleRecurring = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/recurring-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, frequency, dayOfWeek }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error?.message || "Erreur");
        return;
      }
      setMessage("Récurrence programmée ! Vous recevrez un rappel la veille.");
      setShowRecurring(false);
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }, [orderId, frequency, dayOfWeek]);

  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5 space-y-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Commander a nouveau</h3>

      <div className="flex gap-2">
        <button
          onClick={handleReorder}
          disabled={reordering}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
        >
          {reordering ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Recommander
        </button>
        <button
          onClick={() => setShowRecurring(!showRecurring)}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
        >
          <CalendarClock size={16} />
          Programmer
        </button>
      </div>

      {/* Recurring modal */}
      {showRecurring && (
        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Programmer une recurrence chez {shopName}
            </p>
            <button onClick={() => setShowRecurring(false)}>
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-400">Frequence</label>
            <div className="flex gap-2 mt-1">
              {(["weekly", "biweekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    frequency === f
                      ? "bg-[#DC2626] text-white border-[#DC2626]"
                      : "bg-white dark:bg-[#141414] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
                  }`}
                >
                  {f === "weekly" ? "Chaque semaine" : f === "biweekly" ? "Toutes les 2 sem." : "Chaque mois"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-400">Jour de la semaine</label>
            <div className="flex gap-1 mt-1 overflow-x-auto">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setDayOfWeek(i)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors ${
                    dayOfWeek === i
                      ? "bg-[#DC2626] text-white border-[#DC2626]"
                      : "bg-white dark:bg-[#141414] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
                  }`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Nous vous enverrons un rappel la veille pour confirmer. Aucune commande ne sera passee automatiquement.
          </p>

          <button
            onClick={handleRecurring}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Programmer la recurrence"}
          </button>
        </div>
      )}

      {message && (
        <p className="text-xs text-center text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/5 rounded-lg p-2">
          {message}
        </p>
      )}
    </div>
  );
}
