"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, ShoppingCart, ClipboardList, LogIn } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useCart } from "@/lib/hooks/use-cart";

const NAV_ITEMS = [
  { key: "accueil",    label: "Accueil",    href: "/decouvrir",  icon: Home },
  { key: "ia",         label: "IA",         href: "/chat",       icon: MessageCircle },
  { key: "panier",     label: "Panier",     href: "/panier",     icon: ShoppingCart, badge: true },
  { key: "commandes",  label: "Commandes",  href: "/commandes",  icon: ClipboardList },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-[#2a2520] border-t border-gray-100 dark:border-[#3a3530] px-2 pb-safe z-50">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
                isActive ? "text-[#DC2626] dark:text-[#DC2626]" : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                {"badge" in item && item.badge && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Profile / Sign-in tab */}
        <SignedIn>
          <div className="flex flex-col items-center gap-0.5 py-2 px-3">
            <UserButton afterSignOutUrl="/decouvrir" />
            <span className="text-[10px] leading-none font-medium text-gray-400 dark:text-gray-500">Profil</span>
          </div>
        </SignedIn>
        <SignedOut>
          <Link
            href="/sign-in"
            className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
              pathname === "/sign-in" ? "text-[#DC2626] dark:text-[#DC2626]" : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <LogIn size={22} strokeWidth={1.8} />
            <span className="text-[10px] leading-none font-medium">Connexion</span>
          </Link>
        </SignedOut>
      </div>
    </nav>
  );
}
