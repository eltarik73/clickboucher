"use client";

import React from "react";
import Link from "next/link";
import { MapPin, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientHeaderProps {
  title?: string;
  showLocation?: boolean;
  showCart?: boolean;
  cartCount?: number;
  className?: string;
}

export function ClientHeader({
  title,
  showLocation = true,
  showCart = true,
  cartCount = 0,
  className,
}: ClientHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-40 glass border-b border-border/40", className)}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* Left: Location or Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {showLocation ? (
            <button type="button" className="flex items-center gap-2 tap-scale">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/8 border border-primary/10">
                <MapPin size={16} className="text-primary" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">Retrait à</span>
                <span className="text-sm font-semibold text-foreground truncate">Chambéry</span>
              </div>
            </button>
          ) : (
            <h1 style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg font-bold truncate">{title}</h1>
          )}
        </div>

        {/* Center: Brand */}
        {showLocation && (
          <Link href="/decouvrir" className="absolute left-1/2 -translate-x-1/2">
            <span style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg font-bold tracking-tight">
              <span className="text-primary">Click</span>
              <span className="text-amber-600">Boucher</span>
            </span>
          </Link>
        )}

        {/* Right: Cart + Avatar */}
        <div className="flex items-center gap-2">
          {showCart && (
            <Link
              href="/panier"
              className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border/60 hover:border-primary/20 transition-all tap-scale"
            >
              <ShoppingBag size={17} strokeWidth={2} className="text-foreground/70" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.125rem] h-[1.125rem] rounded-full bg-amber-500 text-white text-[0.6rem] font-bold shadow-sm animate-scale-in">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border/60 hover:border-primary/20 transition-all tap-scale"
          >
            <User size={17} strokeWidth={2} className="text-foreground/70" />
          </button>
        </div>
      </div>
    </header>
  );
}
