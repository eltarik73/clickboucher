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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/40"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-5xl items-center justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 tap-scale min-w-[4rem]",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} className="transition-all duration-200" />
                {isActive && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-amber-500" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-semibold leading-none transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
