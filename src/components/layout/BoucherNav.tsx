"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard",  label: "Dashboard",  href: "/boucher/dashboard",  icon: LayoutDashboard },
  { key: "commandes",  label: "Commandes",  href: "/boucher/commandes",  icon: ClipboardList, badge: true },
  { key: "produits",   label: "Produits",   href: "/boucher/produits",   icon: Package },
  { key: "clients",    label: "Clients",    href: "/boucher/clients",    icon: Users },
  { key: "parametres", label: "Parametres", href: "/boucher/parametres", icon: Settings },
] as const;

export function BoucherNav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] bg-white border-r border-gray-200 flex-col z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <Link href="/boucher/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#8b2500] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Klik&Go</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Espace boucher</p>
            </div>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#8b2500]/10 text-[#8b2500]"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && pendingCount > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center bg-[#8b2500] text-white text-[10px] font-bold rounded-full px-1.5">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-1 pb-safe z-50">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 text-xs transition-colors ${
                  isActive ? "text-[#8b2500]" : "text-gray-400"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  {"badge" in item && item.badge && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-[#8b2500] text-white text-[9px] font-bold rounded-full px-1">
                      {pendingCount > 99 ? "99+" : pendingCount}
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
