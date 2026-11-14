import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { X } from "lucide-react";
import { IconButton, iconButtonVariants } from "@/components/ui/icon-button";

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

describe("IconButton", () => {
  it("est nommé par son libellé", () => {
    render(<IconButton label="Fermer" icon={<X />} />);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveAttribute("aria-label", "Fermer");
  });

  it("ne compile pas sans libellé", () => {
    // @ts-expect-error label est obligatoire
    const unnamed = <IconButton icon={<X />} />;
    expect(unnamed).toBeTruthy();
  });

  it("mesure 44 px en md et 56 px en lg, sans pouvoir rétrécir", () => {
    const md = classesOf(iconButtonVariants({ size: "md" }));
    const lg = classesOf(iconButtonVariants({ size: "lg" }));
    expect(md).toEqual(expect.arrayContaining(["size-11", "shrink-0", "rounded-full"]));
    expect(lg).toEqual(expect.arrayContaining(["size-14", "shrink-0"]));
    render(<IconButton label="Fermer" icon={<X />} />);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveClass("size-11", "shrink-0");
  });

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

  it("asChild rend un lien nommé par le libellé qui contient l'icône", () => {
    const { container } = render(
      <IconButton asChild label="Retour à l'accueil" icon={<X />}>
        <a href="/" />
      </IconButton>,
    );
    const link = screen.getByRole("link", { name: "Retour à l'accueil" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveClass("size-11");
    expect(link.querySelector("span[aria-hidden='true'] svg")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
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

  it.each(["ghost", "subtle", "solid"] as const)("la variante %s n'utilise que des jetons", (variant) => {
    const classes = iconButtonVariants({ variant });
    expect(classes).not.toMatch(/#|gray-|transition-all|(^|\s)outline-none/);
  });
});
