"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Percent, Heart, ClipboardList, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Découvrir", href: "/decouvrir", icon: Compass },
  { label: "Bons plans", href: "/bons-plans", icon: Percent },
  { label: "Favoris", href: "/favoris", icon: Heart },
  { label: "Commandes", href: "/commandes", icon: ClipboardList },
  { label: "Pro", href: "/pro", icon: Briefcase },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-zinc-100" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-around px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[3.5rem] py-1.5 rounded-2xl transition-all duration-200 tap-scale",
                isActive ? "text-primary" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={cn("text-[10px] font-semibold leading-none", isActive && "text-primary")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
