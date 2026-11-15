// @vitest-environment node
//
// One rule decides which recipes are indexable: the Prisma filter (sitemap, /recettes list) and
// the predicate (recipe page robots) must always agree.

import { describe, it, expect } from "vitest";
import { indexableRecipeWhere, isRecipeIndexable } from "@/lib/seo/recipes";

type Flags = { published: boolean; aiGenerated: boolean; featured: boolean };

// Evaluates the filter on one recipe: equality on the scalar fields, any branch of OR.
function filterAccepts(recipe: Flags): boolean {
  const { OR, ...scalars } = indexableRecipeWhere;
  const matches = (where: object) =>
    Object.entries(where).every(([field, value]) => recipe[field as keyof Flags] === value);
  const orBranches = Array.isArray(OR) ? OR : [];
  return matches(scalars) && orBranches.some((branch) => matches(branch));
}

const ALL_FLAGS: Flags[] = [false, true].flatMap((published) =>
  [false, true].flatMap((aiGenerated) =>
    [false, true].map((featured) => ({ published, aiGenerated, featured }))
  )
);

describe("indexable recipes", () => {
  it("indexes published hand-written recipes and featured AI recipes only", () => {
    expect(isRecipeIndexable({ published: true, aiGenerated: false, featured: false })).toBe(true);
    expect(isRecipeIndexable({ published: true, aiGenerated: true, featured: true })).toBe(true);
    expect(isRecipeIndexable({ published: true, aiGenerated: true, featured: false })).toBe(false);
    expect(isRecipeIndexable({ published: false, aiGenerated: false, featured: true })).toBe(false);
  });

  it.each(ALL_FLAGS)("filter and predicate agree on %o", (recipe) => {
    expect(filterAccepts(recipe)).toBe(isRecipeIndexable(recipe));
  });
});
