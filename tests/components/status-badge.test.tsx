import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import type { OrderStatus, ShopStatus } from "@prisma/client";
import { badgeVariants } from "@/components/ui/badge";
import { OrderStatusBadge, ShopStatusBadge } from "@/components/ui/status-badge";
import type { StatusTone } from "@/lib/design-tokens";

// How a tone looks belongs to Badge: these tests pin the tone and the words of each status.
describe("OrderStatusBadge", () => {
  it.each<[OrderStatus, string, StatusTone]>([
    ["PENDING", "En attente", "warning"],
    ["PREPARING", "En préparation", "info"],
    ["READY", "Prête", "success"],
    ["DENIED", "Refusée", "destructive"],
    ["COMPLETED", "Terminée", "neutral"],
  ])("%s : « %s », teinte %s", (status, label, tone) => {
    render(<OrderStatusBadge status={status} />);
    expect(screen.getByText(label).className).toBe(badgeVariants({ variant: tone }));
  });

  it("ajoute la classe de l'appelant", () => {
    render(<OrderStatusBadge status="READY" className="ml-2" />);
    expect(screen.getByText("Prête")).toHaveClass("ml-2");
  });
});

describe("ShopStatusBadge", () => {
  it.each<[ShopStatus, string, StatusTone]>([
    ["OPEN", "Ouvert", "success"],
    ["BUSY", "Occupé", "warning"],
    ["AUTO_PAUSED", "Auto-pause", "destructive"],
    ["VACATION", "Vacances", "info"],
    ["CLOSED", "Fermé", "neutral"],
  ])("%s : « %s », teinte %s", (status, label, tone) => {
    render(<ShopStatusBadge status={status} />);
    expect(screen.getByText(label).className).toBe(badgeVariants({ variant: tone }));
  });
});
