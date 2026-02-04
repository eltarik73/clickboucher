"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TogglePillProps {
  label: string;
  isActive?: boolean;
  active?: boolean;
  onToggle?: (active: boolean) => void;
  onClick?: () => void;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode;
  inactiveIcon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TogglePill({
  label,
  isActive,
  active,
  onToggle,
  onClick,
  icon,
  activeIcon,
  inactiveIcon,
  size = "md",
  className,
}: TogglePillProps) {
  const on = isActive ?? active ?? false;

  const handleClick = () => {
    if (onClick) onClick();
    else if (onToggle) onToggle(!on);
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-micro gap-1.5",
    md: "px-4 py-2 text-caption gap-2",
    lg: "px-5 py-2.5 text-body gap-2.5",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-all duration-200 select-none tap-scale",
        sizeClasses[size],
        on
          ? "bg-primary text-primary-foreground shadow-glow"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
        className
      )}
      aria-pressed={on}
    >
      {icon ? icon : on ? activeIcon : inactiveIcon}
      <span>{label}</span>
    </button>
  );
}
