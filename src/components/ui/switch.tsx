"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// The click and the content belong to the switch: onCheckedChange is its only event.
export type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "onClick" | "children" | "role" | "type" | "aria-checked"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

// 44x24 track with a 2 px border. The after pseudo-element widens the hit area to 44x44: its
// offsets count from the padding box (40x20, border excluded), hence 2 px on each side
// (40 + 2 x 2) and 12 px above and below (20 + 2 x 12).
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, ...props }, ref) => (
    <button
      ref={ref}
      role="switch"
      type="button"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "after:absolute after:-inset-x-0.5 after:-inset-y-3",
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted-foreground",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
);
Switch.displayName = "Switch";

export interface SwitchFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
}: SwitchFieldProps) {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;
  const descriptionId = `${switchId}-description`;

  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={switchId} className="text-body font-semibold text-foreground">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-caption text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
      />
    </div>
  );
}

export { Switch, SwitchField };
