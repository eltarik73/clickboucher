// /recettes filters by theme on the client (RecipeBrowser): the server renders the whole list
// once (ISR, no searchParams read), a theme button filters it in place, and a ?tag= link from
// another page (footer) filters it after mount.
import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RecipeBrowser, type RecipeListItem } from "@/app/(client)/recettes/RecipeBrowser";

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean | null }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

function recipe(slug: string, title: string, tags: string[], featured = false): RecipeListItem {
  return {
    id: `id-${slug}`,
    slug,
    title,
    description: `Description de ${title}`,
    imageUrl: null,
    totalTime: 45,
    servings: 4,
    difficulty: "Facile",
    meatQuantity: "800 g d'agneau",
    tags,
    featured,
  };
}

const RECIPES: RecipeListItem[] = [
  recipe("tajine-agneau", "Tajine d'agneau aux pruneaux", ["agneau", "famille"]),
  recipe("brochettes-boeuf", "Brochettes de bœuf marinées", ["boeuf", "bbq"], true),
  recipe("poulet-roti", "Poulet rôti au citron", ["volaille"]),
  recipe("gigot-agneau", "Gigot d'agneau de l'Aïd", ["agneau", "ramadan"]),
];

function recipeLinks(): string[] {
  return screen
    .queryAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/recettes/"));
}

function themeButton(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: "Filtrer par thème" })).getByRole("button", {
    name,
  });
}

let replaceState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.history.pushState(null, "", "/recettes");
  replaceState = vi.spyOn(window.history, "replaceState");
});

afterEach(() => {
  cleanup();
  replaceState.mockRestore();
  window.history.pushState(null, "", "/");
});

describe("RecipeBrowser", () => {
  it("renders every recipe on the server and at first render, « Tout » selected", () => {
    const html = renderToString(<RecipeBrowser recipes={RECIPES} />);
    for (const { slug } of RECIPES) expect(html).toContain(`href="/recettes/${slug}"`);

    render(<RecipeBrowser recipes={RECIPES} />);

    expect(recipeLinks().sort()).toEqual(RECIPES.map((r) => `/recettes/${r.slug}`).sort());
    expect(themeButton("Tout")).toHaveAttribute("aria-pressed", "true");
    expect(themeButton("Agneau")).toHaveAttribute("aria-pressed", "false");
  });

  it("puts the featured recipe first, as « À la une »", () => {
    render(<RecipeBrowser recipes={RECIPES} />);

    expect(recipeLinks()[0]).toBe("/recettes/brochettes-boeuf");
    expect(screen.getByText("À la une")).toBeInTheDocument();
  });

  it("filters on a theme click and writes the theme in the URL", () => {
    render(<RecipeBrowser recipes={RECIPES} />);

    fireEvent.click(themeButton("Agneau"));

    expect(recipeLinks().sort()).toEqual(["/recettes/gigot-agneau", "/recettes/tajine-agneau"]);
    expect(themeButton("Agneau")).toHaveAttribute("aria-pressed", "true");
    expect(themeButton("Tout")).toHaveAttribute("aria-pressed", "false");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/recettes?tag=agneau");

    fireEvent.click(themeButton("Tout"));

    expect(recipeLinks()).toHaveLength(RECIPES.length);
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/recettes");
  });

  it("filters from a theme shortcut card", () => {
    render(<RecipeBrowser recipes={RECIPES} />);

    fireEvent.click(screen.getByRole("button", { name: /Spécial Ramadan/ }));

    expect(recipeLinks()).toEqual(["/recettes/gigot-agneau"]);
    expect(themeButton("Ramadan")).toHaveAttribute("aria-pressed", "true");
  });

  it("applies ?tag=agneau present at mount after the effect", async () => {
    window.history.pushState(null, "", "/recettes?tag=agneau");

    render(<RecipeBrowser recipes={RECIPES} />);
    await act(async () => {});

    expect(recipeLinks().sort()).toEqual(["/recettes/gigot-agneau", "/recettes/tajine-agneau"]);
    expect(themeButton("Agneau")).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores an unknown ?tag= and shows every recipe", async () => {
    window.history.pushState(null, "", "/recettes?tag=inconnu");

    render(<RecipeBrowser recipes={RECIPES} />);
    await act(async () => {});

    expect(recipeLinks()).toHaveLength(RECIPES.length);
    expect(themeButton("Tout")).toHaveAttribute("aria-pressed", "true");
  });

  it("says when a theme has no recipe and offers to show them all", () => {
    render(<RecipeBrowser recipes={RECIPES} />);

    fireEvent.click(themeButton("Veau"));

    expect(recipeLinks()).toEqual([]);
    expect(screen.getByText("Aucune recette pour ce thème pour le moment.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voir toutes les recettes" }));
    expect(recipeLinks()).toHaveLength(RECIPES.length);
  });

  it("says when there is no recipe at all", () => {
    render(<RecipeBrowser recipes={[]} />);

    expect(screen.getByText("Aucune recette pour le moment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Découvrir les boutiques" })).toHaveAttribute(
      "href",
      "/"
    );
  });
});
