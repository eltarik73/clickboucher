// SeoFooter links the hub pages (search page, regional hub, every department) so they are
// reached from every client page, without prefetch (CLAUDE.md, « Coût CPU Vercel ») and only
// towards pages that exist.
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SeoFooter } from "@/components/layout/SeoFooter";
import { SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { isClosedRoutePath } from "@/lib/seo/routes";

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean | null }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

afterEach(cleanup);

const HUB_PATHS = [
  "/trouver-boucherie-halal",
  "/boucheries-halal-rhone-alpes",
  ...SEO_DEPARTMENTS.map((dept) => `/boucheries-halal/${dept.slug}`),
];

describe("SeoFooter hub links", () => {
  it("lists the search page, the regional hub and the five departments", () => {
    render(<SeoFooter />);
    const column = screen.getByRole("heading", { name: "Boucheries halal par région" })
      .parentElement as HTMLElement;

    const hrefs = within(column)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(SEO_DEPARTMENTS).toHaveLength(5);
    expect(hrefs).toEqual(HUB_PATHS);
    expect(
      within(column).getByRole("link", { name: "Boucheries halal dans le Rhône" })
    ).toHaveAttribute("href", "/boucheries-halal/rhone");
  });

  it("links every hub once, without prefetch, to an existing page", () => {
    render(<SeoFooter />);
    const links = screen.getAllByRole("link");

    for (const path of HUB_PATHS) {
      const matching = links.filter((link) => link.getAttribute("href") === path);
      expect(matching, path).toHaveLength(1);
      expect(matching[0]).toHaveAttribute("data-prefetch", "false");
      expect(isClosedRoutePath(path), path).toBe(true);
    }
  });

  it("never prefetches any footer link", () => {
    render(<SeoFooter />);

    const prefetched = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("data-prefetch") !== "false");
    expect(prefetched).toEqual([]);
  });
});
