import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { X } from "lucide-react";
import { IconButton, iconButtonVariants } from "@/components/ui/icon-button";

describe("IconButton", () => {
  it("est nommé par son libellé", () => {
    render(<IconButton label="Fermer" icon={<X />} />);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveAttribute("aria-label", "Fermer");
  });

  // size-N is N × 4 px on both sides: 44 px is size-11. shrink-0 keeps it in a crowded flex row.
  it.each(["md", "lg"] as const)(
    "la taille %s mesure au moins 44 × 44 px et ne rétrécit pas",
    (size) => {
      const classes = iconButtonVariants({ size }).split(/\s+/);
      const sides = classes.filter((name) => /^size-\d+$/.test(name));
      expect(sides).toHaveLength(1);
      expect(Number(sides[0].slice(5)) * 4).toBeGreaterThanOrEqual(44);
      expect(classes).toContain("shrink-0");
    }
  );

  it("masque l'icône aux technologies d'assistance", () => {
    render(<IconButton label="Fermer" icon={<X />} />);
    const button = screen.getByRole("button", { name: "Fermer" });
    const wrapper = button.querySelector("span");
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper?.querySelector("svg")).not.toBeNull();
  });

  it("est de type button par défaut, type modifiable", () => {
    const { rerender } = render(<IconButton label="Fermer" icon={<X />} />);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveAttribute("type", "button");
    rerender(<IconButton label="Fermer" icon={<X />} type="submit" />);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveAttribute("type", "submit");
  });

  it("transmet la ref et onClick", () => {
    const ref = React.createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(<IconButton ref={ref} label="Fermer" icon={<X />} onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Fermer" });
    expect(ref.current).toBe(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
