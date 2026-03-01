// PriceAdjustmentBanner — 3-tier client price adjustment UI
"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, Clock, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";

type PriceAdjustment = {
  id: string;
  originalTotal: number;
  newTotal: number;
  reason: string | null;
  adjustmentType: string;
  status: string;
  tier: number;
  autoApproveAt: string | null;
  escalateAt: string | null;
  createdAt: string;
};

type Props = {
  orderId: string;
  adjustment: PriceAdjustment;
  onUpdate: () => void;
};

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default function PriceAdjustmentBanner({ orderId, adjustment, onUpdate }: Props) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Countdown timer (for tier 2 auto-approve)
  useEffect(() => {
    if (!adjustment.autoApproveAt) return;

    const update = () => {
      const remaining = Math.max(0, new Date(adjustment.autoApproveAt!).getTime() - Date.now());
      setSecondsLeft(Math.ceil(remaining / 1000));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [adjustment.autoApproveAt]);

  // Auto-refresh when timer expires (triggers lazy auto-approve on server)
  useEffect(() => {
    if (adjustment.status !== "PENDING") return;
    if (!adjustment.autoApproveAt) return;
    if (secondsLeft > 0) return;

    const timeout = setTimeout(() => onUpdate(), 1500);
    return () => clearTimeout(timeout);
  }, [secondsLeft, adjustment.status, adjustment.autoApproveAt, onUpdate]);

  const handleAction = useCallback(async (action: "accept" | "reject") => {
    setLoading(action);
    try {
      const res = await fetch(`/api/orders/${orderId}/adjustment/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === "accept" ? "Ajustement accepte" : "Ajustement refuse");
        onUpdate();
      } else {
        toast.error(data.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setLoading(null);
    }
  }, [orderId, onUpdate]);

  const diff = adjustment.newTotal - adjustment.originalTotal;
  const diffPct = adjustment.originalTotal > 0
    ? ((adjustment.newTotal - adjustment.originalTotal) / adjustment.originalTotal) * 100
    : 0;
  const tier = adjustment.tier || 1;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  // ═══════════════════════════════════════════
  // PENDING — tier-specific UI
  // ═══════════════════════════════════════════
  if (adjustment.status === "PENDING") {
    // ── Tier 2: 30s countdown + refuse button only ──
    if (tier === 2) {
      return (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/15 rounded-2xl border border-amber-200 dark:border-amber-700/30 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Ajustement de prix (palier 2)
            </h3>
            {secondsLeft > 0 && (
              <span className="ml-auto text-lg font-mono font-bold text-amber-600 dark:text-amber-400">
                {secondsLeft}s
              </span>
            )}
          </div>

          <p className="text-xs text-amber-700 dark:text-amber-400/80">
            Hausse de <span className="font-bold">+{diffPct.toFixed(1)}%</span> — sera accepte automatiquement{" "}
            {secondsLeft > 0 ? `dans ${secondsLeft}s` : ""}
          </p>

          {adjustment.reason && (
            <p className="text-xs text-amber-700 dark:text-amber-400/70 italic">
              &quot;{adjustment.reason}&quot;
            </p>
          )}

          {/* Price comparison */}
          <div className="flex items-center justify-between bg-white dark:bg-[#141414] rounded-xl px-4 py-3 border border-amber-200/50 dark:border-white/5">
            <div>
              <p className="text-[11px] text-[#999] dark:text-gray-400">Ancien prix</p>
              <p className="text-sm text-[#555] dark:text-gray-300 line-through">{fmtPrice(adjustment.originalTotal)}</p>
            </div>
            <div className="text-xl font-bold text-[#2a2018] dark:text-white">&rarr;</div>
            <div className="text-right">
              <p className="text-[11px] text-[#999] dark:text-gray-400">Nouveau prix</p>
              <p className="text-lg font-bold text-[#2a2018] dark:text-white">{fmtPrice(adjustment.newTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-amber-600">
                +{fmtPrice(diff)}
              </p>
            </div>
          </div>

          {secondsLeft <= 0 ? (
            <div className="text-center py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Delai expire — valide automatiquement
              </p>
            </div>
          ) : (
            <button
              onClick={() => handleAction("reject")}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {loading === "reject" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Refuser l&apos;ajustement
            </button>
          )}
        </div>
      );
    }

    // ── Tier 3: blocking modal — accept/refuse, no auto-approve ──
    if (tier === 3) {
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/15 rounded-2xl border-2 border-red-300 dark:border-red-700/40 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
              Ajustement important (palier 3)
            </h3>
          </div>

          <p className="text-xs text-red-700 dark:text-red-400/80 font-medium">
            Le boucher demande une hausse de <span className="font-bold">+{diffPct.toFixed(1)}%</span>.
            Votre approbation est requise.
          </p>

          {adjustment.reason && (
            <p className="text-xs text-red-700 dark:text-red-400/70 italic bg-red-100 dark:bg-red-900/20 rounded-lg px-3 py-2">
              &quot;{adjustment.reason}&quot;
            </p>
          )}

          {/* Price comparison */}
          <div className="flex items-center justify-between bg-white dark:bg-[#141414] rounded-xl px-4 py-3 border border-red-200/50 dark:border-white/5">
            <div>
              <p className="text-[11px] text-[#999] dark:text-gray-400">Ancien prix</p>
              <p className="text-sm text-[#555] dark:text-gray-300 line-through">{fmtPrice(adjustment.originalTotal)}</p>
            </div>
            <div className="text-xl font-bold text-[#2a2018] dark:text-white">&rarr;</div>
            <div className="text-right">
              <p className="text-[11px] text-[#999] dark:text-gray-400">Nouveau prix</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{fmtPrice(adjustment.newTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-red-600">
                +{fmtPrice(diff)}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleAction("reject")}
              disabled={loading !== null}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {loading === "reject" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Refuser
            </button>
            <button
              onClick={() => handleAction("accept")}
              disabled={loading !== null}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading === "accept" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Accepter
            </button>
          </div>
        </div>
      );
    }

    // ── Tier 1 PENDING (shouldn't normally happen, but handle gracefully) ──
    return (
      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800/30">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="text-emerald-500 animate-spin" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Ajustement en cours de validation...
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // AUTO_APPROVED — info banner (tier 1)
  // ═══════════════════════════════════════════
  if (adjustment.status === "AUTO_APPROVED") {
    return (
      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800/30">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-emerald-500" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Prix ajuste : {fmtPrice(adjustment.originalTotal)} &rarr;{" "}
            <span className="font-bold">{fmtPrice(adjustment.newTotal)}</span>
            {diff <= 0 ? " (baisse)" : ` (+${diffPct.toFixed(1)}%)`}
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // AUTO_VALIDATED — tier 2 auto-approved after timeout
  // ═══════════════════════════════════════════
  if (adjustment.status === "AUTO_VALIDATED") {
    return (
      <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/30">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Prix ajuste automatiquement : {fmtPrice(adjustment.originalTotal)} &rarr;{" "}
            <span className="font-bold">{fmtPrice(adjustment.newTotal)}</span>
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // APPROVED — confirmed by client
  // ═══════════════════════════════════════════
  if (adjustment.status === "APPROVED") {
    return (
      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800/30">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-500" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Ajustement accepte : <span className="font-bold">{fmtPrice(adjustment.newTotal)}</span>
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // REJECTED
  // ═══════════════════════════════════════════
  if (adjustment.status === "REJECTED") {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-800/30">
        <div className="flex items-center gap-2">
          <XCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Ajustement refuse — prix initial maintenu ({fmtPrice(adjustment.originalTotal)})
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ESCALATED — tier 3 timed out, sent to webmaster
  // ═══════════════════════════════════════════
  if (adjustment.status === "ESCALATED") {
    return (
      <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-200 dark:border-orange-800/30 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" />
          <p className="text-sm font-bold text-orange-700 dark:text-orange-400">
            Ajustement escalade
          </p>
        </div>
        <p className="text-xs text-orange-600 dark:text-orange-400/70">
          L&apos;ajustement de {fmtPrice(adjustment.originalTotal)} &rarr; {fmtPrice(adjustment.newTotal)} a ete transmis au service client pour resolution.
        </p>
      </div>
    );
  }

  return null;
}
