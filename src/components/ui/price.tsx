import * as React from "react";
import { cn, formatPrice } from "@/lib/utils";

export interface PriceProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  cents: number;
}

/** An amount on screen: formatPrice stays the only formatting rule. */
function Price({ cents, className, ...props }: PriceProps) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)} {...props}>
      {formatPrice(cents)}
    </span>
  );
}

export { Price };
