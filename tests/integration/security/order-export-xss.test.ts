// @vitest-environment node
// The printable order export (GET /api/orders/export?format=print), on real PostgreSQL. The butcher
// opens it in a tab of klikandgo.app, inside their session: before C1-FAILLES-CRITIQUES a guest
// who typed `<img src=x onerror=…>` as first name ran script there (SEC-01, audit of 2026-11-15).
// Every value typed by a customer or a shop is printed as text, the only script is the print
// button's, allowed by a per-response nonce, and the page is never cached. The CSV export keeps the
// raw text: it is data, not a page. Only the Clerk session is mocked.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => null,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));

import { useCleanDatabase } from "../helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

const { GET: exportOrders } = await import("@/app/api/orders/export/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

/** Typed as a guest first name, stored as is (an order placed before the person-name schema). */
const GUEST_NAME = "<img src=x onerror=alert(1)>";
const PRODUCT_NAME = "<script>alert(2)</script>";
const SHOP_NAME = "<svg onload=alert(3)>";

beforeEach(async () => {
  const owner = await createTestUser({ role: "BOUCHER" });
  const shop = await createTestShop({ ownerId: owner.id, name: SHOP_NAME });
  const product = await createTestProduct(shop.id, { name: PRODUCT_NAME, unit: "PIECE" });
  const filedUnder = await createTestUser();
  await createTestOrder({
    shopId: shop.id,
    userId: filedUnder.id,
    items: [{ productId: product.id }],
    overrides: {
      placedAsGuest: true,
      customerFirstName: GUEST_NAME,
      customerLastName: "Martin",
      customerPhone: "+33611223344",
    },
  });
  session.clerkId = owner.clerkId;
});

const exportAs = (format: "print" | "csv") =>
  exportOrders(new NextRequest(new URL(`/api/orders/export?format=${format}`, "http://localhost")));

/** The directives of a Content-Security-Policy header, by name. */
function cspDirectives(header: string | null): Map<string, string[]> {
  if (header === null) throw new Error("Content-Security-Policy header missing");
  return new Map(
    header
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name !== "")
      .map(([name, ...sources]) => [name, sources])
  );
}

describe("printable order export", () => {
  it("prints a guest name, a product name and a shop name made of markup as text", async () => {
    const response = await exportAs("print");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(body).toContain("&lt;img src=x onerror=alert(1)&gt; Martin");
    expect(body).toContain("1x &lt;script&gt;alert(2)&lt;/script&gt;");
    expect(body).toContain("&lt;svg onload=alert(3)&gt;");
    expect(body).not.toContain("<img");
    expect(body).not.toContain("<svg");
    expect(body).not.toContain("alert(2)</script>");
    expect(body).not.toContain("onclick");
    expect(body.match(/<script\b/g)).toHaveLength(1);
  });

  it("allows only its own nonce'd script, fresh on every response, and is never cached", async () => {
    const first = await exportAs("print");
    const second = await exportAs("print");
    const directives = cspDirectives(first.headers.get("content-security-policy"));
    const scriptSources = directives.get("script-src") ?? [];
    const nonce = /^'nonce-([A-Za-z0-9+/]+={0,2})'$/.exec(scriptSources[0] ?? "")?.[1];

    expect(scriptSources).toHaveLength(1);
    expect(nonce).toBeDefined();
    expect(scriptSources).not.toContain("'unsafe-inline'");
    expect(directives.get("default-src")).toEqual(["'none'"]);
    expect(directives.get("style-src")).toEqual(["'unsafe-inline'"]);
    expect(directives.get("base-uri")).toEqual(["'none'"]);
    expect(directives.get("form-action")).toEqual(["'none'"]);
    expect(await first.text()).toContain(`<script nonce="${nonce}">`);
    expect(second.headers.get("content-security-policy")).not.toContain(`'nonce-${nonce}'`);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
  });

  it("the CSV export of the same order keeps the raw name inside its quoted cell", async () => {
    const response = await exportAs("csv");
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(csv).toContain(`;"<img src=x onerror=alert(1)> Martin";`);
    expect(csv).toContain(`;"1x <script>alert(2)</script>";`);
  });
});
