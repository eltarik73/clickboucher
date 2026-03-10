"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Settings,
  Headphones,
  ChefHat,
  BarChart3,
  Gift,
  Leaf,
} from "lucide-react";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";

const NAV_ITEMS = [
  { key: "dashboard",  label: "Dashboard",   href: "/boucher/dashboard",  icon: LayoutDashboard },
  { key: "commandes",  label: "Commandes",   href: "/boucher/commandes",  icon: ClipboardList, badge: "orders" as const },
  { key: "produits",   label: "Produits",    href: "/boucher/produits",   icon: Package },
  { key: "antigaspi",  label: "Anti-Gaspi",  href: "/boucher/dashboard/anti-gaspi", icon: Leaf },
  { key: "offres",     label: "Offres",      href: "/shop/offers",        icon: Gift, badge: "promos" as const },
  { key: "clients",    label: "Clients",     href: "/boucher/clients",    icon: Users },
  { key: "performance",label: "Performance", href: "/boucher/performance",icon: BarChart3 },
  { key: "support",    label: "Support",     href: "/boucher/support",    icon: Headphones },
  { key: "parametres", label: "Paramètres",  href: "/boucher/parametres", icon: Settings },
] as const;

export function BoucherNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);

  const fetchPending = useCallback(async () => {
    try {
      const [ordersRes, offersRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/shop/offers"),
      ]);
      if (ordersRes.ok) {
        const json = await ordersRes.json();
        const orders: { status: string }[] = json.data || [];
        setPendingCount(orders.filter((o) => o.status === "PENDING").length);
      }
      if (offersRes.ok) {
        const json = await offersRes.json();
        const proposals = json.data?.proposals || [];
        setProposalCount(proposals.filter((p: { status: string }) => p.status === "PENDING").length);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 30_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  function getBadgeCount(badge: string | undefined): number {
    if (badge === "orders") return pendingCount;
    if (badge === "promos") return proposalCount;
    return 0;
  }

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-white/10 flex-col z-40">
        {/* Logo — valorized with glow */}
        <div className="px-5 py-6 border-b border-gray-100 dark:border-white/10">
          <Link href="/boucher/dashboard" className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 blur-2xl opacity-15 dark:opacity-30 bg-[#DC2626] rounded-full scale-150" />
              <KlikLogo size={48} className="relative z-10" />
            </div>
            <div className="text-center">
              <KlikWordmark size="base" />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Espace boucher</p>
            </div>
          </Link>
        </div>

        {/* CTA Mode Cuisine */}
        <div className="px-3 pt-4 pb-2">
          <Link
            href="/boucher/commandes"
            className="flex items-center justify-center gap-2 bg-primary hover:bg-[#b91c1c] text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm shadow-lg shadow-[#DC2626]/25"
          >
            <ChefHat size={18} />
            Mode Cuisine
            {pendingCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center bg-white/20 text-white text-[10px] font-bold rounded-full px-1.5 animate-pulse">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-[#f8f6f3]"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && getBadgeCount(item.badge) > 0 && (
                  <span className={`min-w-[20px] h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-full px-1.5 ${
                    item.badge === "promos" ? "bg-amber-500" : "bg-primary"
                  }`}>
                    {getBadgeCount(item.badge) > 99 ? "99+" : getBadgeCount(item.badge)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-[#141414] border-t border-gray-100 dark:border-white/10 px-1 pb-safe-bottom z-50">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 text-xs transition-colors ${
                  isActive ? "text-primary dark:text-primary" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  {"badge" in item && item.badge && getBadgeCount(item.badge) > 0 && (
                    <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center text-white text-[9px] font-bold rounded-full px-1 ${
                      item.badge === "promos" ? "bg-amber-500" : "bg-primary"
                    }`}>
                      {getBadgeCount(item.badge) > 99 ? "99+" : getBadgeCount(item.badge)}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
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
