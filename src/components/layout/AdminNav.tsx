"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users,
  Package,
  BarChart3,
  Settings,
  CreditCard,
  Crown,
  Headphones,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Boucheries", href: "/admin/shops", icon: Store },
  { label: "Utilisateurs", href: "/admin/users", icon: Users },
  { label: "Commandes", href: "/admin/orders", icon: Package },
  { label: "Formules", href: "/admin/formules", icon: Crown },
  { label: "Commission", href: "/admin/commission", icon: CreditCard },
  { label: "Support", href: "/admin/support", icon: Headphones },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Configuration", href: "/admin/config", icon: Settings },
];

/* ── Sidebar (desktop) ─────────────────────────── */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-[250px] h-screen bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-[white/10] shrink-0 sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-[white/10]">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#DC2626]">Klik&Go</span>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-100 dark:bg-[white/10] px-1.5 py-0.5 rounded">
            Admin
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#DC2626]/10 text-[#DC2626]"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[white/10] hover:text-gray-900 dark:hover:text-[#f8f6f3]"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-[white/10]">
        <Link
          href="/decouvrir"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-[#DC2626] transition-colors"
        >
          ← Retour au site
        </Link>
      </div>
    </aside>
  );
}

/* ── Mobile Bottom Nav ─────────────────────────── */
export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-[#141414] border-t border-gray-100 dark:border-[white/10] px-1 pb-safe z-50">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-2 text-xs transition-colors ${
                isActive
                  ? "text-[#DC2626]"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span
                className={`text-[9px] leading-none ${isActive ? "font-bold" : "font-medium"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Mobile Header with hamburger menu ─────────── */
export function AdminMobileHeader({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Header bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-[#141414] border-b border-gray-100 dark:border-[white/10] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#DC2626]">Klik&Go</span>
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-100 dark:bg-[white/10] px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>
        <Link
          href="/decouvrir"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-[#DC2626] transition-colors"
        >
          ← Site
        </Link>
      </header>

      {/* Slide-over overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onToggle}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-white dark:bg-[#141414] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-bold text-[#DC2626]">
                Klik&Go Admin
              </span>
              <button
                onClick={onToggle}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[white/10]"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onToggle}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#DC2626]/10 text-[#DC2626]"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[white/10]"
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
