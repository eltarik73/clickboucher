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
    <header
      className={cn(
        "sticky top-0 z-40 glass border-b border-border/60",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        {/* Left: Location or Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showLocation ? (
            <button
              type="button"
              className="flex items-center gap-1.5 tap-scale"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <MapPin size={16} className="text-primary" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-micro text-muted-foreground uppercase tracking-wider">
                  Retrait à
                </span>
                <span className="text-caption font-semibold text-foreground truncate">
                  Chambéry
                </span>
              </div>
            </button>
          ) : (
            <h1 className="font-display text-subtitle truncate">{title}</h1>
          )}
        </div>

        {/* Center: Brand */}
        {showLocation && (
          <Link
            href="/decouvrir"
            className="absolute left-1/2 -translate-x-1/2"
          >
            <span className="font-display text-body-lg font-bold tracking-tight">
              <span className="text-primary">Click</span>
              <span className="text-foreground">Boucher</span>
            </span>
          </Link>
        )}

        {/* Right: Cart + Avatar */}
        <div className="flex items-center gap-2">
          {showCart && (
            <Link
              href="/panier"
              className="relative flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors tap-scale"
            >
              <ShoppingBag size={18} strokeWidth={2} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[1.125rem] h-[1.125rem] rounded-full bg-primary text-primary-foreground text-[0.6rem] font-bold px-1 shadow-sm animate-scale-in">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors tap-scale"
          >
            <User size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}
