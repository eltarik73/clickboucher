"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import Image from "next/image";

// ─── Badge ───────────────────────────────────
type BadgeVariant = "default" | "halal" | "open" | "closed" | "express" | "promo" | "status";

const badgeStyles: Record<BadgeVariant, string> = {
  default: "bg-stone-100 text-stone-900 border border-stone-200",
  halal: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  open: "bg-green-50 text-green-600",
  closed: "bg-red-50 text-red-600",
  express: "bg-orange-50 text-orange-600",
  promo: "bg-stone-900 text-white",
  status: "bg-[#FDF2F4] text-[#DC2626]",
};

export function Badge({
  children,
  variant = "default",
  className,
  style,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={style}
        className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        badgeStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Button ──────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type BtnSize = "sm" | "md" | "lg";

const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-[#DC2626] text-white hover:bg-[#9B1B32]",
  secondary: "bg-stone-100 text-stone-900 border border-stone-200 hover:bg-stone-200",
  ghost: "bg-transparent text-stone-500 hover:bg-stone-100",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
  success: "bg-green-50 text-green-600 hover:bg-green-100",
};

const btnSizes: Record<BtnSize, string> = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-6 py-3 text-sm",
  lg: "px-7 py-3.5 text-[15px]",
};

export function Btn({
  children,
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  className,
  style,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={style}
        className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition-all duration-200",
        "hover:-translate-y-px active:translate-y-0",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626]",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}

// ─── Card ────────────────────────────────────
export function Card({
  children,
  onClick,
  className,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      style={style}
        className={cn(
        "bg-white rounded-[20px] border border-stone-200 shadow-sm transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Avatar ──────────────────────────────────
export function Avatar({
  src,
  name,
  size = 44,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-[14px] overflow-hidden bg-stone-100 grid place-items-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={name} width={size} height={size} className="w-full h-full object-cover" />
      ) : (
        <span
          className="text-stone-400 font-bold"
          style={{ fontSize: size * 0.3 }}
        >
          {name?.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

// ─── StatusDot ───────────────────────────────
export function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// ─── Toggle Switch ───────────────────────────
export function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
        className={cn(
        "relative w-[50px] h-7 rounded-full transition-colors duration-200 flex-shrink-0",
        on ? "bg-green-500" : "bg-stone-300"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-md transition-[left] duration-200",
          on ? "left-[25px]" : "left-[3px]"
        )}
      />
    </button>
  );
}

// ─── Empty State ─────────────────────────────
export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-5 animate-fade-in">
      <p className="text-5xl">{icon}</p>
      <p className="text-base font-semibold mt-4">{title}</p>
      {sub && (
        <p className="text-sm text-stone-500 mt-2 max-w-[280px] mx-auto">
          {sub}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Sticky Header ───────────────────────────
export function StickyHeader({
  children,
  dark,
  className,
  style,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
        className={cn(
        "sticky top-0 z-30 backdrop-blur-xl border-b flex items-center gap-3.5 px-5 py-3.5",
        dark
          ? "bg-[#DC2626] text-white border-white/10"
          : "bg-stone-50/85 border-stone-200",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Back Button ─────────────────────────────
export function BackBtn({
  onClick,
  light,
}: {
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-[10px] grid place-items-center text-lg transition-all",
        light
          ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
          : "border border-stone-200 bg-white text-stone-900 hover:bg-stone-50"
      )}
    >
      ←
    </button>
  );
}
