import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in",
        className
      )}
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted text-muted-foreground mb-5">
        {icon}
      </div>
      <h3 className="font-display text-subtitle text-foreground mb-2">
        {title}
      </h3>
      <p className="text-body text-muted-foreground max-w-xs mb-6">
        {description}
      </p>
      {action}
    </div>
  );
}
