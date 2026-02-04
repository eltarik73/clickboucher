import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between px-4 mb-3", className)}>
      <div>
        <h2 className="font-display text-subtitle text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-caption text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="flex items-center gap-0.5 text-caption font-semibold text-primary hover:text-primary/80 transition-colors tap-scale"
        >
          {action.label}
          <ChevronRight size={16} strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}
