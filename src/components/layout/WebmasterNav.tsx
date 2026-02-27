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
  Trophy,
  Users,
  KeyRound,
  ChevronDown,
} from "lucide-react";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: boolean;
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { key: "dashboard",  label: "Dashboard",     href: "/webmaster",              icon: LayoutDashboard, exact: true },
      { key: "boutiques",  label: "Boutiques",     href: "/webmaster/boutiques",    icon: Store },
      { key: "commandes",  label: "Commandes",     href: "/webmaster/commandes",    icon: ClipboardList, badge: true },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { key: "catalogue",  label: "Produits",      href: "/webmaster/catalogue",    icon: Package },
      { key: "reference",  label: "Reference",     href: "/webmaster/catalogue/reference", icon: Package },
      { key: "promos",     label: "Promos",        href: "/webmaster/promos",       icon: Percent },
      { key: "fidelite",  label: "Fidélité",     href: "/webmaster/fidelite",     icon: Trophy },
    ],
  },
  {
    title: "Suivi",
    items: [
      { key: "perf",       label: "Performance",   href: "/webmaster/performance",  icon: BarChart3 },
      { key: "analytics",  label: "Analytics",     href: "/webmaster/analytics",    icon: BarChart3 },
      { key: "capacite",   label: "Capacite",      href: "/webmaster/capacite",     icon: Clock },
      { key: "facturation",label: "Facturation",   href: "/webmaster/facturation",  icon: Coins },
    ],
  },
  {
    title: "Gestion",
    items: [
      { key: "demandes",   label: "Demandes PRO",  href: "/webmaster/demandes",     icon: UserCheck },
      { key: "support",    label: "Support",       href: "/webmaster/support",      icon: Headphones },
      { key: "plans",      label: "Plans & Avis",  href: "/webmaster/plans",        icon: Crown },
      { key: "staff",      label: "Equipe",        href: "/webmaster/staff",        icon: Users },
    ],
  },
  {
    title: "Systeme",
    items: [
      { key: "flags",      label: "Feature Flags", href: "/webmaster/flags",        icon: Flag },
      { key: "api-keys",   label: "Cles API",      href: "/webmaster/api-keys",     icon: KeyRound },
      { key: "audit",      label: "Audit Log",     href: "/webmaster/audit",        icon: Shield },
      { key: "parametres", label: "Parametres",    href: "/webmaster/parametres",   icon: Settings },
    ],
  },
];

// Flat list for isActive lookups
const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

// Subset for mobile bottom nav (max 5 items)
const MOBILE_NAV = ["dashboard", "boutiques", "commandes", "demandes", "parametres"];

export function WebmasterNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

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

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  function toggleSection(title: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
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

        {/* Nav items grouped by section */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {NAV_SECTIONS.map((section, idx) => {
            const isCollapsed = section.title ? collapsedSections.has(section.title) : false;
            const hasActiveItem = section.items.some(isActive);

            return (
              <div key={idx} className={idx > 0 ? "mt-1" : ""}>
                {section.title && (
                  <button
                    onClick={() => toggleSection(section.title!)}
                    className="flex items-center justify-between w-full px-3 py-1.5 mt-1 mb-0.5"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {section.title}
                      {isCollapsed && hasActiveItem && (
                        <span className="ml-1.5 w-1.5 h-1.5 inline-block rounded-full bg-primary" />
                      )}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`text-gray-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    />
                  </button>
                )}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = isActive(item);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                              : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-[#f8f6f3]"
                          }`}
                        >
                          <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && pendingCount > 0 && (
                            <span className="min-w-[20px] h-5 flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full px-1.5">
                              {pendingCount > 99 ? "99+" : pendingCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
          {ALL_ITEMS.filter((item) => MOBILE_NAV.includes(item.key)).map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 text-xs transition-colors ${
                  active ? "text-primary dark:text-primary" : "text-gray-400 dark:text-gray-500"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {item.badge && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-primary text-white text-[9px] font-bold rounded-full px-1">
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
