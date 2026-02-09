"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, ShoppingCart, ClipboardList, LogIn } from "lucide-react";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
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
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-2 pb-safe z-50">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
                isActive ? "text-[#8b2500]" : "text-gray-400"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                {"badge" in item && item.badge && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#8b2500] text-white text-[10px] font-bold rounded-full px-1">
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
        <ProfileTab pathname={pathname} />
      </div>
    </nav>
  );
}

function ProfileTab({ pathname }: { pathname: string }) {
  const isActive = pathname === "/profil" || pathname.startsWith("/profil/");

  return (
    <>
      <SignedIn>
        <SignedInTab isActive={isActive} />
      </SignedIn>
      <SignedOut>
        <Link
          href="/sign-in"
          className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
            pathname === "/sign-in" ? "text-[#8b2500]" : "text-gray-400"
          }`}
        >
          <LogIn size={22} strokeWidth={1.8} />
          <span className="text-[10px] leading-none font-medium">Connexion</span>
        </Link>
      </SignedOut>
    </>
  );
}

function SignedInTab({ isActive }: { isActive: boolean }) {
  const { user } = useUser();

  return (
    <Link
      href="/profil"
      className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
        isActive ? "text-[#8b2500]" : "text-gray-400"
      }`}
    >
      {user?.imageUrl ? (
        <div className={`w-[22px] h-[22px] rounded-full overflow-hidden ${isActive ? "ring-2 ring-[#8b2500]" : ""}`}>
          <Image
            src={user.imageUrl}
            alt=""
            width={22}
            height={22}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className={`w-[22px] h-[22px] rounded-full bg-[#8b2500] flex items-center justify-center text-white text-[10px] font-bold ${isActive ? "ring-2 ring-[#8b2500]/30" : ""}`}>
          {user?.firstName?.[0] || "?"}
        </div>
      )}
      <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
        {user?.firstName || "Profil"}
      </span>
    </Link>
  );
}
