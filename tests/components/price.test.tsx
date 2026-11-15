import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Price } from "@/components/ui/price";

describe("Price", () => {
  it("affiche le montant en euros dans un élément insécable", () => {
    render(<Price cents={1234} className="text-muted-foreground" />);
    const el = screen.getByText("12,34 €");
    expect(el).toHaveClass("whitespace-nowrap", "tabular-nums", "text-muted-foreground");
  });
});
