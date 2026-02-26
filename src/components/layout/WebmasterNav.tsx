"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Store,
  ClipboardList,
  Package,
  Clock,
  Coins,
  UserCheck,
  Headphones,
  Settings,
  Flag,
  Shield,
  BarChart3,
  Crown,
  Percent,
  Users,
  KeyRound,
} from "lucide-react";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";

const NAV_ITEMS = [
  { key: "dashboard",  label: "Dashboard",     href: "/webmaster",              icon: LayoutDashboard, exact: true },
  { key: "boutiques",  label: "Boutiques",     href: "/webmaster/boutiques",    icon: Store },
  { key: "commandes",  label: "Commandes",     href: "/webmaster/commandes",    icon: ClipboardList, badge: true },
  { key: "catalogue",  label: "Catalogue",     href: "/webmaster/catalogue",    icon: Package },
  { key: "capacite",   label: "Capacité",      href: "/webmaster/capacite",     icon: Clock },
  { key: "facturation",label: "Facturation",   href: "/webmaster/facturation",  icon: Coins },
  { key: "demandes",   label: "Demandes PRO",  href: "/webmaster/demandes",     icon: UserCheck },
  { key: "support",    label: "Support",       href: "/webmaster/support",      icon: Headphones },
  { key: "analytics",  label: "Analytics",     href: "/webmaster/analytics",    icon: BarChart3 },
  { key: "plans",      label: "Plans & Avis",  href: "/webmaster/plans",        icon: Crown },
  { key: "promos",     label: "Promos",        href: "/webmaster/promos",       icon: Percent },
  { key: "staff",      label: "Équipe",        href: "/webmaster/staff",        icon: Users },
  { key: "api-keys",   label: "Clés API",      href: "/webmaster/api-keys",     icon: KeyRound },
  { key: "flags",      label: "Feature Flags", href: "/webmaster/flags",        icon: Flag },
  { key: "audit",      label: "Audit Log",     href: "/webmaster/audit",        icon: Shield },
  { key: "parametres", label: "Parametres",    href: "/webmaster/parametres",   icon: Settings },
] as const;

// Subset for mobile bottom nav (max 5 items)
const MOBILE_NAV = ["dashboard", "boutiques", "commandes", "demandes", "parametres"] as const;

export function WebmasterNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const json = await res.json();
        setPendingCount(json.data?.pendingOrders || 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    if ("exact" in item && item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-white/10 flex-col z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100 dark:border-white/10">
          <Link href="/webmaster" className="flex items-center gap-2.5">
            <KlikLogo size={32} />
            <div>
              <KlikWordmark size="sm" />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Espace webmaster</p>
            </div>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-[#DC2626]"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-[#f8f6f3]"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && pendingCount > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1.5">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Version footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Klik&Go Admin v2</p>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-[#141414] border-t border-gray-100 dark:border-white/10 px-1 pb-safe-bottom z-50">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.filter((item) => (MOBILE_NAV as readonly string[]).includes(item.key)).map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 text-xs transition-colors ${
                  active ? "text-[#DC2626] dark:text-[#DC2626]" : "text-gray-400 dark:text-gray-500"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {"badge" in item && item.badge && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-[#DC2626] text-white text-[9px] font-bold rounded-full px-1">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] leading-none ${active ? "font-bold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
