import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Price } from "@/components/ui/price";
import { formatPrice } from "@/lib/utils";

describe("Price", () => {
  it("affiche formatPrice dans un élément insécable", () => {
    render(<Price cents={1234} />);
    const el = screen.getByText(formatPrice(1234));
    expect(el).toHaveClass("whitespace-nowrap", "tabular-nums");
  });

  it("garde le suffixe dans le même élément insécable", () => {
    render(<Price cents={2590} suffix="/kg" />);
    const el = screen.getByText(`${formatPrice(2590)}/kg`);
    expect(el).toHaveClass("whitespace-nowrap");
  });

  it("barre l'ancien prix et l'annonce aux lecteurs d'écran", () => {
    const { container } = render(<Price cents={1500} struck className="text-muted-foreground" />);
    const struck = container.querySelector("s");
    expect(struck).toHaveTextContent(formatPrice(1500));
    const prefix = screen.getByText("Ancien prix :", { exact: false });
    expect(prefix).toHaveClass("sr-only");
    expect(prefix.compareDocumentPosition(struck as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.firstElementChild).toHaveClass("whitespace-nowrap", "text-muted-foreground");
    expect(container.firstElementChild).toHaveTextContent(`Ancien prix : ${formatPrice(1500)}`);
  });
});
