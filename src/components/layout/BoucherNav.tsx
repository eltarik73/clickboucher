"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
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
  Wand2,
} from "lucide-react";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/boucher/dashboard", icon: LayoutDashboard },
  {
    key: "commandes",
    label: "Commandes",
    href: "/boucher/commandes",
    icon: ClipboardList,
    badge: "orders" as const,
  },
  { key: "produits", label: "Produits", href: "/boucher/produits", icon: Package },
  { key: "images", label: "Galerie IA", href: "/boucher/images", icon: Wand2 },
  { key: "antigaspi", label: "Anti-Gaspi", href: "/boucher/dashboard/anti-gaspi", icon: Leaf },
  { key: "offres", label: "Offres", href: "/shop/offers", icon: Gift, badge: "promos" as const },
  { key: "clients", label: "Clients", href: "/boucher/clients", icon: Users },
  { key: "performance", label: "Performance", href: "/boucher/performance", icon: BarChart3 },
  { key: "support", label: "Support", href: "/boucher/support", icon: Headphones },
  { key: "parametres", label: "Paramètres", href: "/boucher/parametres", icon: Settings },
] as const;

export function BoucherNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);

  const fetchPending = useCallback(async () => {
    try {
      const [ordersRes, offersRes] = await Promise.all([
        fetch("/api/boucher/orders/pending-count"),
        fetch("/api/shop/offers"),
      ]);
      let pendingOk = false;
      if (ordersRes.ok) {
        const json: { data?: { pending?: unknown } } = await ordersRes.json();
        const pending = json.data?.pending;
        if (typeof pending === "number") {
          setPendingCount(pending);
          pendingOk = true;
        }
      }
      if (offersRes.ok) {
        const json = await offersRes.json();
        const proposals = json.data?.proposals || [];
        setProposalCount(
          proposals.filter((p: { status: string }) => p.status === "PENDING").length
        );
      }
      return pendingOk;
    } catch {
      return false;
    }
  }, []);

  // Badges : rafraîchis toutes les 30 s, uniquement onglet visible (backoff si le compteur échoue)
  useVisiblePolling(fetchPending, 30_000);

  function getBadgeCount(badge: string | undefined): number {
    if (badge === "orders") return pendingCount;
    if (badge === "promos") return proposalCount;
    return 0;
  }

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[220px] flex-col border-r border-gray-200 bg-white dark:border-white/10 dark:bg-[#141414] md:flex">
        {/* Logo — valorized with glow */}
        <div className="border-b border-gray-100 px-5 py-6 dark:border-white/10">
          <Link
            href="/boucher/dashboard"
            prefetch={false}
            className="flex flex-col items-center gap-2"
          >
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-full bg-[#DC2626] opacity-15 blur-2xl dark:opacity-30" />
              <KlikLogo size={48} className="relative z-10" />
            </div>
            <div className="text-center">
              <KlikWordmark size="base" />
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">Espace boucher</p>
            </div>
          </Link>
        </div>

        {/* CTA Mode Cuisine */}
        <div className="px-3 pb-2 pt-4">
          <Link
            href="/boucher/commandes"
            prefetch={false}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-[#DC2626]/25 transition-all hover:bg-[#b91c1c] active:scale-95"
          >
            <ChefHat size={18} />
            Mode Cuisine
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-[20px] animate-pulse items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-[#f8f6f3]"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && getBadgeCount(item.badge) > 0 && (
                  <span
                    className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ${
                      item.badge === "promos" ? "bg-amber-500" : "bg-primary"
                    }`}
                  >
                    {getBadgeCount(item.badge) > 99 ? "99+" : getBadgeCount(item.badge)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white px-1 pb-safe-bottom dark:border-white/10 dark:bg-[#141414] md:hidden">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors ${
                  isActive ? "text-primary dark:text-primary" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  {"badge" in item && item.badge && getBadgeCount(item.badge) > 0 && (
                    <span
                      className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                        item.badge === "promos" ? "bg-amber-500" : "bg-primary"
                      }`}
                    >
                      {getBadgeCount(item.badge) > 99 ? "99+" : getBadgeCount(item.badge)}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}
                >
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
