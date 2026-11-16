import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { KlikGoLogo } from "@/components/layout/KlikGoLogo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("logo Klik&Go", () => {
  it("KlikLogo : une image nommée Klik&Go, de 40 px par défaut", () => {
    render(<KlikLogo />);
    expect(screen.getByRole("img", { name: "Klik&Go" })).toHaveStyle({
      width: "40px",
      height: "40px",
    });
  });

  it("KlikLogo : la taille demandée et la classe de l'appelant", () => {
    render(<KlikLogo size={48} className="relative z-10" />);
    const mark = screen.getByRole("img", { name: "Klik&Go" });
    expect(mark).toHaveStyle({ width: "48px", height: "48px" });
    expect(mark).toHaveClass("relative", "z-10");
  });

  it("KlikWordmark : se lit Klik&Go et garde la classe de l'appelant", () => {
    const { container } = render(<KlikWordmark size="xl" className="mt-3" />);
    expect(container.firstElementChild).toHaveTextContent(/^Klik&Go$/);
    expect(container.firstElementChild).toHaveClass("mt-3");
  });

  it("KlikGoLogo : un seul nom accessible « Klik&Go », porté par le texte ; la pastille est masquée", () => {
    const { container } = render(<KlikGoLogo />);
    expect(screen.getByRole("button", { name: "Klik&Go" })).toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("KlikGoLogo : pastille de 40 px par défaut, à la taille demandée sinon", () => {
    const { container, rerender } = render(<KlikGoLogo />);
    expect(container.querySelector("svg")).toHaveStyle({ width: "40px", height: "40px" });
    rerender(<KlikGoLogo logoSize={28} wordmarkSize="sm" />);
    expect(container.querySelector("svg")).toHaveStyle({ width: "28px", height: "28px" });
  });

  it("deux pastilles sur une page ont des identifiants de dégradé distincts", () => {
    const { container } = render(
      <>
        <KlikLogo />
        <KlikLogo />
      </>
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
