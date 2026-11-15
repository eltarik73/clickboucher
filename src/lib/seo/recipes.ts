// Which recipes may be indexed and submitted to search engines: published, and either written
// by hand or AI-generated but featured by the webmaster (bulk AI content stays out of the
// index). The sitemap, the recipe page robots and the /recettes ItemList all use this rule:
// the Prisma filter for queries, the predicate for a recipe already loaded.

import type { Prisma } from "@prisma/client";

export const indexableRecipeWhere: Prisma.RecipeWhereInput = {
  published: true,
  OR: [{ aiGenerated: false }, { featured: true }],
};

export function isRecipeIndexable(recipe: {
  published: boolean;
  aiGenerated: boolean;
  featured: boolean;
}): boolean {
  return recipe.published && (!recipe.aiGenerated || recipe.featured);
}
