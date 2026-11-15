import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { KlikGoLogo } from "@/components/layout/KlikGoLogo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/** useId differs from one render to the next: markup is compared with the gradient id replaced. */
const normalize = (html: string) => html.replace(/brand-mark-[A-Za-z0-9_-]+/g, "brand-mark-ID");

const MARK_BODY =
  '<defs><linearGradient id="brand-mark-ID" x1="0%" y1="0%" x2="100%" y2="100%">' +
  '<stop offset="0%" stop-color="#a83320"></stop><stop offset="50%" stop-color="#DC2626"></stop>' +
  '<stop offset="100%" stop-color="#DC2626"></stop></linearGradient></defs>' +
  '<circle cx="50" cy="50" r="46" fill="url(#brand-mark-ID)"></circle>' +
  '<path d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z" fill="white"></path>' +
  '<rect x="76" y="33" width="14" height="3.5" rx="1.75" fill="white" opacity="0.7"></rect>' +
  '<rect x="79" y="43" width="16" height="3" rx="1.5" fill="white" opacity="0.5"></rect>' +
  '<rect x="76" y="53" width="12" height="2.5" rx="1.25" fill="white" opacity="0.3"></rect>';

const WORDMARK_BODY =
  '<span class="text-foreground">Klik</span>' +
  '<span class="font-black not-italic text-primary">&amp;</span>' +
  '<span class="text-foreground">Go</span>';

const TAP_BUTTON =
  '<button type="button" class="bg-transparent border-none cursor-pointer p-0 select-none">';

describe("logo Klik&Go", () => {
  it("KlikLogo : une image nommée Klik&Go, taille par style, classe de l'appelant ajoutée", () => {
    const { container } = render(<KlikLogo size={48} className="relative z-10" />);
    expect(screen.getByRole("img", { name: "Klik&Go" })).toBeInTheDocument();
    expect(normalize(container.innerHTML)).toBe(
      '<svg viewBox="0 0 100 100" style="width: 48px; height: 48px;" class="rounded-full relative z-10" role="img" aria-label="Klik&amp;Go">' +
        MARK_BODY +
        "</svg>"
    );
  });

  it("KlikLogo : 40 px par défaut", () => {
    const { container } = render(<KlikLogo />);
    expect(normalize(container.innerHTML)).toBe(
      '<svg viewBox="0 0 100 100" style="width: 40px; height: 40px;" class="rounded-full" role="img" aria-label="Klik&amp;Go">' +
        MARK_BODY +
        "</svg>"
    );
  });

  it("KlikWordmark : taille base par défaut, taille et classe de l'appelant", () => {
    const base = render(<KlikWordmark />).container.innerHTML;
    const xl = render(<KlikWordmark size="xl" className="mt-3" />).container.innerHTML;
    expect(base).toBe(
      `<span class="font-extrabold tracking-tight text-base">${WORDMARK_BODY}</span>`
    );
    expect(xl).toBe(
      `<span class="font-extrabold tracking-tight text-2xl mt-3">${WORDMARK_BODY}</span>`
    );
  });

  it("KlikGoLogo : un seul nom accessible « Klik&Go », porté par le texte ; la pastille est masquée", () => {
    const { container } = render(<KlikGoLogo logoSize={28} wordmarkSize="sm" />);
    expect(screen.getByRole("button", { name: "Klik&Go" })).toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(normalize(container.innerHTML)).toBe(
      TAP_BUTTON +
        '<span class="inline-flex items-center gap-2.5 align-middle">' +
        '<svg viewBox="0 0 100 100" style="width: 28px; height: 28px;" class="rounded-full" aria-hidden="true">' +
        MARK_BODY +
        "</svg>" +
        `<span class="font-extrabold tracking-tight text-sm">${WORDMARK_BODY}</span>` +
        "</span></button>"
    );
  });

  it("KlikGoLogo : pastille de 40 px et mot-symbole lg par défaut", () => {
    const { container } = render(<KlikGoLogo />);
    expect(normalize(container.innerHTML)).toBe(
      TAP_BUTTON +
        '<span class="inline-flex items-center gap-2.5 align-middle">' +
        '<svg viewBox="0 0 100 100" style="width: 40px; height: 40px;" class="rounded-full" aria-hidden="true">' +
        MARK_BODY +
        "</svg>" +
        `<span class="font-extrabold tracking-tight text-xl">${WORDMARK_BODY}</span>` +
        "</span></button>"
    );
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
