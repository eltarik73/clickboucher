"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Tag, ShoppingBag, User, LogIn } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useCart } from "@/lib/hooks/use-cart";
import { useTestAuth } from "@/hooks/useTestAuth";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: typeof Home;
  badge?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "accueil", label: "Accueil", href: "/", icon: Home },
  { key: "recherche", label: "Recherche", href: "/recherche", icon: Search },
  { key: "bons-plans", label: "Bons Plans", href: "/bons-plans", icon: Tag },
  { key: "panier", label: "Panier", href: "/panier", icon: ShoppingBag, badge: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { enabled: testEnabled, activated: testActivated } = useTestAuth();

  // Don't show on boucher/admin/webmaster pages
  if (
    pathname.startsWith("/boucher") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/webmaster")
  ) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/[0.08]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1.5 rounded-xl transition-colors ${
                isActive ? "text-[#DC2626]" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                {item.badge && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Compte tab — Clerk aware */}
        {testEnabled && testActivated ? (
          <div className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1.5">
            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold">
              T
            </div>
            <span className="text-[10px] leading-none font-medium text-gray-500 dark:text-gray-400">
              Test
            </span>
          </div>
        ) : (
          <>
            <SignedIn>
              <div className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1.5">
                <UserButton afterSignOutUrl="/" />
                <span className="text-[10px] leading-none font-medium text-gray-500 dark:text-gray-400">
                  Profil
                </span>
              </div>
            </SignedIn>
            <SignedOut>
              <Link
                href="/sign-in"
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1.5 rounded-xl transition-colors ${
                  pathname === "/sign-in"
                    ? "text-[#DC2626]"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <LogIn size={22} strokeWidth={1.8} />
                <span className="text-[10px] leading-none font-medium">
                  Connexion
                </span>
              </Link>
            </SignedOut>
          </>
        )}
      </div>
    </nav>
  );
}
