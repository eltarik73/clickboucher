// src/components/boucher/dashboard/ShopStatusBar.tsx — the shop's state on the butcher dashboard
// (online, busy, paused, closed, on vacation) with the actions that change it.
import { AlertCircle, Flame, Palmtree, Pause, Play, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/** GET /api/boucher/shop/status, as the dashboard reads it. */
export type ShopStatus = {
  id: string;
  name: string;
  rating: number;
  ratingCount: number;
  status: string;
  busyMode: boolean;
  busyExtraMin: number;
  busyModeEndsAt: string | null;
  paused: boolean;
  pauseReason: string | null;
  pauseEndsAt: string | null;
  autoPaused: boolean;
  vacationMode: boolean;
  vacationEnd: string | null;
  vacationMessage: string | null;
  prepTimeMin: number;
  effectivePrepTime: number;
};

export function timeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const h = Math.floor(diff / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h} h ${min.toString().padStart(2, "0")} min`;
  if (min > 0) return `${min} min ${sec.toString().padStart(2, "0")} s`;
  return `${sec} s`;
}

export function ShopStatusBar({
  shop,
  onAction,
  loading,
}: {
  shop: ShopStatus;
  onAction: (action: string, data?: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const configs: Record<
    string,
    { bg: string; text: string; label: string; icon: React.ReactNode }
  > = {
    OPEN: {
      bg: "bg-emerald-500",
      text: "text-white",
      label: "Vous êtes en ligne",
      icon: <Play size={14} />,
    },
    BUSY: {
      bg: "bg-amber-500",
      text: "text-white",
      label: `Mode occupé (+${shop.busyExtraMin}min)`,
      icon: <Flame size={14} />,
    },
    PAUSED: {
      bg: "bg-red-500",
      text: "text-white",
      label: "Commandes en pause",
      icon: <Pause size={14} />,
    },
    AUTO_PAUSED: {
      bg: "bg-red-600",
      text: "text-white",
      label: "Pause automatique — commandes manquées",
      icon: <AlertCircle size={14} />,
    },
    CLOSED: { bg: "bg-gray-500", text: "text-white", label: "Fermé", icon: <Pause size={14} /> },
    VACATION: {
      bg: "bg-purple-500",
      text: "text-white",
      label: `Vacances${shop.vacationEnd ? ` jusqu'au ${new Date(shop.vacationEnd).toLocaleDateString("fr-FR")}` : ""}`,
      icon: <Palmtree size={14} />,
    },
  };

  const config = configs[shop.status] || configs.OPEN;
  const isPausedState = shop.status === "PAUSED" || shop.status === "AUTO_PAUSED";
  const isBusy = shop.status === "BUSY";
  const isVacation = shop.status === "VACATION";

  return (
    <div
      className={`${config.bg} rounded-xl px-4 py-3 ${shop.status === "AUTO_PAUSED" ? "animate-pulse" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {config.icon}
          <span className={`text-sm font-semibold ${config.text} truncate`}>{config.label}</span>
          {shop.pauseReason && isPausedState && (
            <span className="truncate text-xs text-white/70">({shop.pauseReason})</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isPausedState && (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
              onClick={() => onAction("resume")}
              disabled={loading}
            >
              <Play size={12} className="mr-1" /> Reprendre
            </Button>
          )}
          {isVacation && (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
              onClick={() => onAction("end_vacation")}
              disabled={loading}
            >
              Fin vacances
            </Button>
          )}
          {isBusy && (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
              onClick={() => onAction("end_busy")}
              disabled={loading}
            >
              Arrêter busy
            </Button>
          )}
          {shop.status === "CLOSED" && (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 border-0 bg-emerald-500/80 text-xs text-white hover:bg-emerald-500"
              onClick={() => onAction("resume")}
              disabled={loading}
            >
              <Play size={12} className="mr-1" /> Passer en ligne
            </Button>
          )}
          {shop.status === "OPEN" && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() => onAction("pause")}
                disabled={loading}
              >
                <Pause size={12} className="mr-1" /> Pause
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() => onAction("busy", { extraMin: 15, durationMin: 60 })}
                disabled={loading}
              >
                <Flame size={12} className="mr-1" /> Occupé
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 border-0 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() => onAction("close")}
                disabled={loading}
              >
                <WifiOff size={12} className="mr-1" /> Fermer
              </Button>
            </>
          )}
        </div>
      </div>
      {shop.pauseEndsAt && isPausedState && (
        <p className="mt-1 text-xs text-white/70">
          Reprise auto dans {timeRemaining(shop.pauseEndsAt)}
        </p>
      )}
      {shop.busyModeEndsAt && isBusy && (
        <p className="mt-1 text-xs text-white/70">
          Fin du mode occupé dans {timeRemaining(shop.busyModeEndsAt)}
        </p>
      )}
    </div>
  );
}
