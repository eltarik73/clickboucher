// src/app/(boucher)/boucher/commandes/KitchenBanners.tsx — the banners under the kitchen's top bar:
// session expired, truncated board, pause in progress, screen sleep not preventable.
import { AlertTriangle, Pause, RefreshCw } from "lucide-react";
import type { KitchenShop } from "./use-shop-status";

type Props = {
  authExpired: boolean;
  activeTruncated: boolean;
  shop: KitchenShop;
  wakeLockSupported: boolean;
};

export default function KitchenBanners({
  authExpired,
  activeTruncated,
  shop,
  wakeLockSupported,
}: Props) {
  return (
    <>
      {/* ── SESSION EXPIRED BANNER (3 consecutive 401/403 on the orders poll) ── */}
      {authExpired && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-red-500/30 bg-red-500/15 px-3 py-2 sm:px-4"
        >
          <p className="min-w-0 text-sm font-bold text-red-300">
            <AlertTriangle size={14} className="-mt-0.5 mr-1.5 inline" />
            Session expirée
            <span className="font-medium text-red-200/80">
              {" "}
              — les nouvelles commandes ne s'affichent plus. Rechargez la page pour vous
              reconnecter.
            </span>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] px-4 text-sm font-bold text-white transition-all hover:bg-[#b91c1c] active:scale-95"
          >
            <RefreshCw size={16} /> Recharger
          </button>
        </div>
      )}

      {/* ── ACTIVE ORDERS TRUNCATED BANNER (server safety cap reached) ── */}
      {activeTruncated && (
        <div
          role="alert"
          className="shrink-0 border-b border-red-500/30 bg-red-500/15 px-3 py-2 sm:px-4"
        >
          <p className="text-sm font-bold text-red-300">
            <AlertTriangle size={14} className="-mt-0.5 mr-1.5 inline" />
            Trop de commandes actives pour toutes les afficher. Traitez ou annulez les plus
            anciennes, ou contactez le support.
          </p>
        </div>
      )}

      {/* ── PAUSE BANNER (v3 — fond discret, countdown) ── */}
      {shop.status === "PAUSED" && (
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-4 py-2"
          style={{
            background: "rgba(245,158,11,0.1)",
            borderBottom: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <p className="text-sm font-bold text-[#F59E0B]">
            <Pause size={14} className="mr-1.5 inline" />
            Commandes suspendues
            {shop.pauseCountdown ? ` — reprise dans ${shop.pauseCountdown}` : ""}
          </p>
          <button
            onClick={() => shop.setStatus({ action: "resume" })}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#F59E0B] px-4 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[#D97706]"
          >
            Reprendre
          </button>
        </div>
      )}

      {/* ── Wake Lock not supported warning ── */}
      {!wakeLockSupported && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-center">
          <p className="text-[11px] text-amber-400">
            Désactivez la mise en veille dans les paramètres de votre tablette
          </p>
        </div>
      )}
    </>
  );
}
