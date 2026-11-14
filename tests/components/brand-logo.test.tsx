import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { KlikGoLogo } from "@/components/layout/KlikGoLogo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/** useId change d'un rendu à l'autre : on compare le balisage à identifiant près. */
const normalize = (html: string) => html.replace(/brand-mark-[A-Za-z0-9_-]+/g, "brand-mark-ID");

describe("BrandLogo", () => {
  it("variante mark : une image nommée Klik&Go à la taille demandée", () => {
    render(<BrandLogo variant="mark" markSize={56} className="relative" />);
    const img = screen.getByRole("img", { name: "Klik&Go" });
    expect(img).toHaveStyle({ width: "56px", height: "56px" });
    expect(img).toHaveClass("rounded-full", "relative");
  });

  it("variante mark : 40 px par défaut", () => {
    render(<BrandLogo variant="mark" />);
    expect(screen.getByRole("img", { name: "Klik&Go" })).toHaveStyle({ width: "40px", height: "40px" });
  });

  it("variante wordmark : texte en tokens, sans couleur hexadécimale ni poids en ligne", () => {
    const { container } = render(<BrandLogo variant="wordmark" wordmarkSize="xl" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveTextContent("Klik&Go");
    expect(root).toHaveClass("font-extrabold", "tracking-tight", "text-2xl");
    expect(root.getAttribute("style")).toBeNull();
    expect(screen.getByText("&")).toHaveClass("text-primary", "font-black");
    expect(container.innerHTML).not.toMatch(/text-\[#|gray-/);
  });

  it("variante lockup : le nom lisible est le texte, la pastille est décorative", () => {
    const { container } = render(<BrandLogo />);
    expect(container.firstElementChild).toHaveTextContent("Klik&Go");
    expect(screen.queryByRole("img")).toBeNull();
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("aria-label");
    expect(svg).toHaveStyle({ width: "40px" });
    expect(container.querySelector(".text-xl")).not.toBeNull();
  });

  it("variante lockup : boîte en ligne alignée au milieu, pas sur la ligne de base", () => {
    const { container } = render(<BrandLogo />);
    expect(container.firstElementChild).toHaveClass("inline-flex", "items-center", "align-middle");
  });

  it("deux pastilles sur une page ont des identifiants de dégradé distincts", () => {
    const { container } = render(
      <>
        <BrandLogo variant="mark" />
        <BrandLogo variant="mark" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    container.querySelectorAll("svg").forEach((svg, i) => {
      expect(svg.querySelector("circle")).toHaveAttribute("fill", `url(#${ids[i]})`);
      expect(ids[i]).toMatch(/^brand-mark-[A-Za-z0-9_-]+$/);
    });
  });
});

describe("Délégation des anciens logos", () => {
  it("KlikLogo rend la variante mark", () => {
    const a = render(<KlikLogo size={48} className="relative z-10" />).container.innerHTML;
    const b = render(<BrandLogo variant="mark" markSize={48} className="relative z-10" />).container.innerHTML;
    expect(normalize(a)).toBe(normalize(b));
  });

  it("KlikWordmark rend la variante wordmark (taille base par défaut)", () => {
    const a = render(<KlikWordmark />).container.innerHTML;
    const b = render(<BrandLogo variant="wordmark" wordmarkSize="base" />).container.innerHTML;
    expect(normalize(a)).toBe(normalize(b));
  });

  it("KlikGoLogo enveloppe la variante lockup dans SecretTapLogo", () => {
    const { container } = render(<KlikGoLogo logoSize={28} wordmarkSize="sm" />);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    const b = render(<BrandLogo variant="lockup" markSize={28} wordmarkSize="sm" />).container.innerHTML;
    expect(normalize((button as HTMLButtonElement).innerHTML)).toBe(normalize(b));
  });
});
