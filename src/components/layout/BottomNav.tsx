"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Heart, ShoppingCart, ClipboardList, LogIn } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useCart } from "@/lib/hooks/use-cart";
import { useNotifications } from "@/lib/hooks/use-notifications";

type NavItem =
  | { key: string; label: string; href: string; icon: typeof Home; badge?: "cart" | "notif"; action?: undefined }
  | { key: string; label: string; icon: typeof Home; action: () => void; href?: undefined; badge?: undefined };

function getNavItems(): NavItem[] {
  return [
    { key: "accueil",   label: "Accueil",   href: "/decouvrir",  icon: Home },
    { key: "favoris",   label: "Favoris",    href: "/favoris",    icon: Heart },
    // Center button is rendered separately as elevated
    { key: "panier",    label: "Panier",     href: "/panier",     icon: ShoppingCart, badge: "cart" as const },
    { key: "commandes", label: "Commandes",  href: "/commandes",  icon: ClipboardList, badge: "notif" as const },
  ];
}

export function BottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { unreadCount } = useNotifications();

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-t border-gray-100/80 dark:border-white/[0.06] px-2 pb-safe-bottom z-50">
      <div className="flex items-end justify-around relative">
        {/* Left items: Accueil + Favoris */}
        {navItems.slice(0, 2).map((item) => {
          const isActive = item.href ? (pathname === item.href || pathname.startsWith(item.href + "/")) : false;
          const Icon = item.icon;
          return (
            <Link key={item.key} href={item.href!} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${isActive ? "text-[#DC2626]" : "text-gray-400 dark:text-gray-500"}`}>
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</span>
            </Link>
          );
        })}

        {/* Elevated center "Mon Boucher" button — pointer-events isolated */}
        <div className="flex flex-col items-center -mt-7 pointer-events-none">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("klikgo:open-chat"))}
            className="pointer-events-auto w-[52px] h-[52px] rounded-full bg-[#DC2626] flex items-center justify-center shadow-lg shadow-[#DC2626]/40 ring-4 ring-white dark:ring-black relative"
          >
            <span className="absolute inset-0 rounded-full bg-[#DC2626] animate-ping opacity-15" />
            <MessageCircle size={24} className="text-white relative z-10" fill="white" strokeWidth={0} />
          </button>
          <span className="pointer-events-none text-[10px] leading-none font-bold text-[#DC2626] mt-1">Mon Boucher</span>
        </div>

        {/* Right items: Panier + Commandes */}
        {navItems.slice(2).map((item) => {
          const isActive = item.href ? (pathname === item.href || pathname.startsWith(item.href + "/")) : false;
          const Icon = item.icon;
          return (
            <Link key={item.key} href={item.href!} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${isActive ? "text-[#DC2626]" : "text-gray-400 dark:text-gray-500"}`}>
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                {item.badge === "cart" && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
                {item.badge === "notif" && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</span>
            </Link>
          );
        })}

        {/* Profile / Sign-in tab */}
        <SignedIn>
          <div className="relative z-10 flex flex-col items-center gap-0.5 py-2 px-3">
            <UserButton afterSignOutUrl="/decouvrir" />
            <span className="text-[10px] leading-none font-medium text-gray-400 dark:text-gray-500">Profil</span>
          </div>
        </SignedIn>
        <SignedOut>
          <Link
            href="/sign-in"
            className={`relative z-10 flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
              pathname === "/sign-in" ? "text-[#DC2626]" : "text-gray-400 dark:text-gray-500"
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
