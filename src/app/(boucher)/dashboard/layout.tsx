"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  Power,
  Zap,
  Clock,
  Plus,
  Minus,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TogglePill } from "@/components/ui/toggle-pill";
import { Stepper } from "@/components/ui/stepper";

const BOUCHER_NAV = [
  { label: "Commandes", href: "/dashboard/commandes", icon: ShoppingBag },
  { label: "Catalogue", href: "/dashboard/catalogue", icon: Package },
  { label: "Clients", href: "/dashboard/clients", icon: Users },
  { label: "Réglages", href: "/dashboard/parametres", icon: Settings },
] as const;

export default function BoucherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [serviceActive, setServiceActive] = useState(true);
  const [surchargeMode, setSurchargeMode] = useState(false);
  const [prepTime, setPrepTime] = useState(15);
  const [maxOrders, setMaxOrders] = useState(5);

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Sticky Header ─── */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border/50">
          <Link href="/dashboard/commandes" className="flex items-center gap-2">
            <span className="font-display text-body-lg font-bold">
              <span className="text-primary">Click</span>
              <span className="text-foreground">Boucher</span>
            </span>
            <span className="text-micro text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              PRO
            </span>
          </Link>
          <span className="text-caption text-muted-foreground">
            Savoie Tradition
          </span>
        </div>

        {/* Service controls */}
        <div className="px-4 py-3 space-y-3">
          {/* Row 1: Service + Surcharge toggles */}
          <div className="flex items-center gap-3 flex-wrap">
            <TogglePill
              label={
                serviceActive
                  ? "🟢 Service activé"
                  : "⚪ Service désactivé"
              }
              isActive={serviceActive}
              onToggle={setServiceActive}
              activeIcon={<Power size={14} />}
              inactiveIcon={<Power size={14} />}
            />
            <TogglePill
              label="Mode surcharge"
              isActive={surchargeMode}
              onToggle={setSurchargeMode}
              activeIcon={<Zap size={14} />}
              inactiveIcon={<Zap size={14} />}
              size="sm"
            />
          </div>

          {!serviceActive && (
            <p className="text-micro text-destructive font-medium bg-destructive/5 rounded-lg px-3 py-1.5">
              Aucune commande acceptée tant que le service est désactivé
            </p>
          )}

          {/* Row 2: Prep time + capacity */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-caption text-muted-foreground whitespace-nowrap">
                Prépa :
              </span>
              <div className="flex items-center gap-1">
                {[5, 10, 15].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setPrepTime((prev) => prev + min)}
                    className="h-7 px-2 rounded-lg bg-muted text-micro font-semibold hover:bg-muted/70 transition-colors tap-scale"
                  >
                    +{min}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPrepTime(15)}
                  className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors tap-scale"
                  title="Réinitialiser"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
              <span className="text-caption font-bold tabular-nums min-w-[2.5rem] text-center">
                {prepTime} min
              </span>
            </div>

            <Stepper
              value={maxOrders}
              onChange={setMaxOrders}
              min={1}
              max={20}
              label="Max/15min :"
              size="sm"
            />
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ─── */}
      <nav className="sticky top-[8.5rem] z-40 bg-background border-b border-border">
        <div className="flex">
          {BOUCHER_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 text-caption font-semibold border-b-2 transition-all duration-200",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Content ─── */}
      <main className="max-w-3xl mx-auto">{children}</main>
    </div>
  );
}
