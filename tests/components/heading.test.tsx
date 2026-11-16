import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Heading } from "@/components/ui/heading";

describe("Heading", () => {
  it.each([1, 2, 3, 4] as const)("rend un h%i", (level) => {
    render(<Heading level={level}>Titre</Heading>);
    expect(screen.getByRole("heading", { level, name: "Titre" }).tagName).toBe(`H${level}`);
  });

  it("dissocie le niveau de la taille", () => {
    render(
      <Heading level={3} size="hero">
        Grand h3
      </Heading>
    );
    expect(screen.getByRole("heading", { level: 3, name: "Grand h3" }).tagName).toBe("H3");
  });
});
