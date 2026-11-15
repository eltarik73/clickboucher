import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import type { OrderStatus, ShopStatus } from "@prisma/client";
import { OrderStatusBadge, ShopStatusBadge } from "@/components/ui/status-badge";
import type { ORDER_STATUS_LABELS } from "@/lib/design-tokens";

// @ts-expect-error the label maps are keyed by the Prisma enum: a plain string is not a key
type LabelOfAnyString = (typeof ORDER_STATUS_LABELS)[string];

describe("OrderStatusBadge", () => {
  it.each<[OrderStatus, string, string, string]>([
    ["PENDING", "En attente", "bg-warning-subtle", "text-warning-text"],
    ["PREPARING", "En préparation", "bg-info-subtle", "text-info-text"],
    ["READY", "Prête", "bg-success-subtle", "text-success-text"],
    ["DENIED", "Refusée", "bg-destructive-subtle", "text-destructive-text"],
    ["COMPLETED", "Terminée", "bg-muted", "text-muted-foreground"],
  ])("%s : « %s » sur %s / %s, sans retour à la ligne", (status, label, bg, text) => {
    render(<OrderStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(bg, text, "whitespace-nowrap");
  });

  it("ajoute la classe de l'appelant", () => {
    render(<OrderStatusBadge status="READY" className="ml-2" />);
    expect(screen.getByText("Prête")).toHaveClass("bg-success-subtle", "ml-2");
  });

  it("refuse un statut hors de l'énumération Prisma", () => {
    // @ts-expect-error UNKNOWN n'est pas un OrderStatus
    const element = <OrderStatusBadge status="UNKNOWN" />;
    expect(element).toBeTruthy();
  });
});

describe("ShopStatusBadge", () => {
  it.each<[ShopStatus, string, string, string]>([
    ["OPEN", "Ouvert", "bg-success-subtle", "text-success-text"],
    ["BUSY", "Occupé", "bg-warning-subtle", "text-warning-text"],
    ["AUTO_PAUSED", "Auto-pause", "bg-destructive-subtle", "text-destructive-text"],
    ["VACATION", "Vacances", "bg-info-subtle", "text-info-text"],
    ["CLOSED", "Fermé", "bg-muted", "text-muted-foreground"],
  ])("%s : « %s » sur %s / %s", (status, label, bg, text) => {
    render(<ShopStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(bg, text);
  });

  it("refuse un statut hors de l'énumération Prisma", () => {
    // @ts-expect-error UNKNOWN n'est pas un ShopStatus
    const element = <ShopStatusBadge status="UNKNOWN" />;
    expect(element).toBeTruthy();
  });
});
