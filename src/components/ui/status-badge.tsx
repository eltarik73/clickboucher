import type { OrderStatus, ShopStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  SHOP_STATUS_LABELS,
  SHOP_STATUS_TONE,
} from "@/lib/design-tokens";

function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge variant={ORDER_STATUS_TONE[status]} className={className}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

function ShopStatusBadge({ status, className }: { status: ShopStatus; className?: string }) {
  return (
    <Badge variant={SHOP_STATUS_TONE[status]} className={className}>
      {SHOP_STATUS_LABELS[status]}
    </Badge>
  );
}

export { OrderStatusBadge, ShopStatusBadge };
