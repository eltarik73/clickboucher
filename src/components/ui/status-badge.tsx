import type { OrderStatus, ShopStatus } from "@prisma/client";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  SHOP_STATUS_LABELS,
  SHOP_STATUS_TONE,
  type StatusTone,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-subtle text-info-text",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  danger: "bg-destructive-subtle text-destructive-text",
};

export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-micro font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <StatusBadge tone={ORDER_STATUS_TONE[status]} className={className}>
      {ORDER_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function ShopStatusBadge({ status, className }: { status: ShopStatus; className?: string }) {
  return (
    <StatusBadge tone={SHOP_STATUS_TONE[status]} className={className}>
      {SHOP_STATUS_LABELS[status]}
    </StatusBadge>
  );
}
