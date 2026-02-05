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

export function ClientHeader({ title, showLocation = true, showCart = true, cartCount = 0, className }: ClientHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-100", className)}>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {showLocation ? (
            <button type="button" className="flex items-center gap-2 tap-scale">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-100">
                <MapPin size={15} className="text-primary" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Retrait à</span>
                <span className="text-[13px] font-semibold text-zinc-900">Chambéry</span>
              </div>
            </button>
          ) : (
            <h1 className="text-base font-bold truncate">{title}</h1>
          )}
        </div>

        {showLocation && (
          <Link href="/decouvrir" className="absolute left-1/2 -translate-x-1/2">
            <span className="text-base font-extrabold tracking-tight">
              <span className="text-primary">Click</span><span className="text-zinc-900">Boucher</span>
            </span>
          </Link>
        )}

        <div className="flex items-center gap-1.5">
          {showCart && (
            <Link href="/panier" className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-colors tap-scale">
              <ShoppingBag size={16} strokeWidth={2} className="text-zinc-700" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1 animate-scale-in">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          )}
          <button type="button" className="flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-colors tap-scale">
            <User size={16} strokeWidth={2} className="text-zinc-700" />
          </button>
        </div>
      </div>
    </header>
  );
}
