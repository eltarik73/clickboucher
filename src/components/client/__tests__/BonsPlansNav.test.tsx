// Les pages /bons-plans ne défilent pas de côté à 375 px : une marge négative horizontale (-mx-N)
// déborde de la page si son parent n'a pas le padding px-N correspondant. jsdom ne calcule pas la
// mise en page : le test lit les classes Tailwind du layout rendu avec sa barre d'onglets.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BonsPlansLayout from "@/app/(client)/bons-plans/layout";

vi.mock("next/navigation", () => ({ usePathname: () => "/bons-plans/anti-gaspi" }));

afterEach(cleanup);

describe("BonsPlansLayout", () => {
  it("n'a aucune marge négative horizontale sans le padding du parent qui la compense", () => {
    const { container } = render(
      <BonsPlansLayout>
        <p>Contenu</p>
      </BonsPlansLayout>
    );

    expect(container.querySelector('a[href="/bons-plans/anti-gaspi"]')).not.toBeNull();
    const unmatched = Array.from(container.querySelectorAll("*")).flatMap((element) =>
      Array.from(element.classList)
        .map((name) => /^-mx-(\d+)$/.exec(name)?.[1])
        .filter((size): size is string => size !== undefined)
        .filter((size) => !element.parentElement?.classList.contains(`px-${size}`))
        .map((size) => `${element.tagName.toLowerCase()} -mx-${size}`)
    );
    expect(unmatched).toEqual([]);
  });
});
