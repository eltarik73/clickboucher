"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

const variantClasses = {
  default: "bg-muted text-foreground hover:bg-muted/80",
  primary: "bg-primary/10 text-primary hover:bg-primary/15",
  success: "bg-success/10 text-success hover:bg-success/15",
  warning: "bg-warning/10 text-warning hover:bg-warning/15",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/15",
};

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto no-scrollbar", className)}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-caption font-semibold transition-all duration-200 tap-scale",
            variantClasses[action.variant ?? "default"],
            action.disabled && "opacity-50 pointer-events-none"
          )}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
