import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Price } from "@/components/ui/price";

describe("Price", () => {
  it("affiche le montant en euros et garde la classe de l'appelant", () => {
    render(<Price cents={1234} className="text-muted-foreground" />);
    expect(screen.getByText("12,34 €")).toHaveClass("text-muted-foreground");
  });
});
