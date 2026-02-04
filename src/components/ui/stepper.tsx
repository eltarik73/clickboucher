"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  size = "md",
  className,
}: StepperProps) {
  const sizeConfig = {
    sm: { button: "h-7 w-7", text: "text-caption min-w-[2rem]", icon: 14 },
    md: { button: "h-9 w-9", text: "text-body min-w-[2.5rem]", icon: 16 },
    lg: { button: "h-11 w-11", text: "text-subtitle min-w-[3rem]", icon: 18 },
  };

  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className="text-caption text-muted-foreground mr-1">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-foreground transition-all duration-150 tap-scale hover:bg-muted/70 disabled:opacity-30 disabled:pointer-events-none",
          config.button
        )}
        aria-label="Diminuer"
      >
        <Minus size={config.icon} strokeWidth={2.5} />
      </button>
      <span
        className={cn(
          "text-center font-semibold tabular-nums",
          config.text
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className={cn(
          "flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-150 tap-scale hover:bg-primary/90 disabled:opacity-30 disabled:pointer-events-none",
          config.button
        )}
        aria-label="Augmenter"
      >
        <Plus size={config.icon} strokeWidth={2.5} />
      </button>
    </div>
  );
}
