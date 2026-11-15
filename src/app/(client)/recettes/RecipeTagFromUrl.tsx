"use client";

// Reads the ?tag= of the URL for RecipeBrowser and renders nothing. RecipeBrowser mounts it in a
// Suspense boundary of its own: during the static prerender useSearchParams bails out to client
// rendering up to the nearest boundary, so only this empty component is left out of the HTML and
// the recipe list stays in it. useSearchParams follows every URL change (a footer link to
// /recettes?tag=… while already on /recettes, history.replaceState after a theme click), which a
// one-time read of window.location at mount did not.

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function RecipeTagFromUrl({ onTag }: { onTag: (tag: string | null) => void }) {
  const tag = useSearchParams().get("tag");

  useEffect(() => {
    onTag(tag);
  }, [tag, onTag]);

  return null;
}
