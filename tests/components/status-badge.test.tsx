import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import type { OrderStatus, ShopStatus } from "@prisma/client";
import { OrderStatusBadge, ShopStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  SHOP_STATUS_LABELS,
  SHOP_STATUS_TONE,
  type StatusTone,
} from "@/lib/design-tokens";

const TONE_CLASSES: Record<StatusTone, [string, string]> = {
  neutral: ["bg-muted", "text-muted-foreground"],
  info: ["bg-info-subtle", "text-info-text"],
  success: ["bg-success-subtle", "text-success-text"],
  warning: ["bg-warning-subtle", "text-warning-text"],
  danger: ["bg-destructive-subtle", "text-destructive-text"],
};

describe("StatusBadge", () => {
  it.each(Object.keys(TONE_CLASSES) as StatusTone[])("ton %s", (tone) => {
    render(<StatusBadge tone={tone}>Libellé</StatusBadge>);
    const el = screen.getByText("Libellé");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("whitespace-nowrap", "rounded-full", "text-micro", ...TONE_CLASSES[tone]);
  });
});

describe("OrderStatusBadge", () => {
  it.each(Object.keys(ORDER_STATUS_TONE) as OrderStatus[])("%s : libellé et ton de design-tokens", (status) => {
    render(<OrderStatusBadge status={status} />);
    const el = screen.getByText(ORDER_STATUS_LABELS[status]);
    expect(el).toHaveClass(...TONE_CLASSES[ORDER_STATUS_TONE[status]]);
  });

  it("READY est un succès, DENIED un danger, PENDING un avertissement", () => {
    expect(ORDER_STATUS_TONE.READY).toBe("success");
    expect(ORDER_STATUS_TONE.DENIED).toBe("danger");
    expect(ORDER_STATUS_TONE.PENDING).toBe("warning");
    render(<OrderStatusBadge status="READY" className="ml-2" />);
    expect(screen.getByText(ORDER_STATUS_LABELS.READY)).toHaveClass("bg-success-subtle", "ml-2");
  });

  it("refuse un statut hors de l'énumération Prisma", () => {
    // @ts-expect-error UNKNOWN n'est pas un OrderStatus
    const element = <OrderStatusBadge status="UNKNOWN" />;
    expect(element).toBeTruthy();
  });
});

describe("ShopStatusBadge", () => {
  it.each(Object.keys(SHOP_STATUS_TONE) as ShopStatus[])("%s : libellé et ton de design-tokens", (status) => {
    render(<ShopStatusBadge status={status} />);
    const el = screen.getByText(SHOP_STATUS_LABELS[status]);
    expect(el).toHaveClass(...TONE_CLASSES[SHOP_STATUS_TONE[status]]);
  });

  it("refuse un statut hors de l'énumération Prisma", () => {
    // @ts-expect-error UNKNOWN n'est pas un ShopStatus
    const element = <ShopStatusBadge status="UNKNOWN" />;
    expect(element).toBeTruthy();
  });
});
