// @vitest-environment node
// planRepairs (src/lib/images/repair-plan.ts) : chaque règle du plan de réparation des URL d'image,
// et les gardes des scripts du propriétaire (adresses sondées, sources copiées, base locale).
import { describe, expect, it, vi } from "vitest";
import type { CensusRow } from "@/lib/images/census";
import { IMAGE_COLUMNS } from "@/lib/images/columns";
import { classifyImageUrl, imageBlobHost } from "@/lib/images/durable-url";
import {
  applyRefusal,
  imageColumnOf,
  isAllowedCopySource,
  isLocalDatabaseUrl,
  isProbeableUrl,
  needsSourceProbe,
  planRepairs,
  registryUsageFor,
  type ProbeResult,
  type RepairAction,
} from "@/lib/images/repair-plan";

const UNSPLASH =
  "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75";
const UNSPLASH_DEAD =
  "https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75";
const BLOB = `https://${imageBlobHost()}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`;
const FOREIGN = "https://abcdefghijklmnop.public.blob.vercel-storage.com/x.webp";
const REPLICATE = "https://replicate.delivery/xezq/abc/out-0.webp";
const LEGACY_UPLOAD = "/api/uploads/products/a.webp";

let sequence = 0;
function row(table: string, column: string, value: string, extra: Partial<CensusRow> = {}) {
  sequence += 1;
  const base = { table, column, id: `row${sequence}`, value, kind: classifyImageUrl(value) };
  return { ...base, shopId: "shop-a", shopSlug: "boucherie-a", label: "Produit", ...extra };
}

const probe = (url: string, alive: boolean, status: number | null, error?: string) =>
  ({ url, alive, status, contentType: null, ...(error ? { error } : {}) }) as ProbeResult;
const alive = (url: string, status = 200) => probe(url, true, status);
const failed = (url: string, status: number | null, error?: string) =>
  probe(url, false, status, error);

function plan(rows: CensusRow[], probes: ProbeResult[] = []): RepairAction[] {
  return planRepairs(rows, new Map(probes.map((result) => [result.url, result])), {
    localFileExists: () => true,
  });
}

/** L'action unique décidée pour une valeur dans une colonne. */
function only(table: string, column: string, value: string, probes: ProbeResult[] = []) {
  const actions = plan([row(table, column, value)], probes);
  expect(actions).toHaveLength(1);
  return actions[0];
}
const act = (table: string, column: string, value: string, probes: ProbeResult[] = []) =>
  only(table, column, value, probes).action;

describe("planRepairs — valeurs durables", () => {
  it("garde une photo de notre stockage non vérifiée ou vivante", () => {
    expect(act("products", "image_url", BLOB)).toBe("SKIP");
    expect(act("products", "image_url", BLOB, [alive(BLOB, 206)])).toBe("SKIP");
  });

  it("notre stockage répond 404 ou 410 : NULL si la colonne a un repli, sinon décision", () => {
    expect(act("products", "image_url", BLOB, [failed(BLOB, 404)])).toBe("NULL");
    expect(act("product_images", "url", BLOB, [failed(BLOB, 404)])).toBe("DECIDE");
    expect(act("shops", "banner_url", BLOB, [failed(BLOB, 410)])).toBe("DECIDE");
  });

  it("notre stockage ne répond pas (réseau, 5xx) : décision, jamais NULL", () => {
    const timeout = only("products", "image_url", BLOB, [failed(BLOB, null, "délai dépassé")]);
    expect(timeout).toMatchObject({ action: "DECIDE", reason: expect.stringContaining("délai") });
    expect(act("products", "image_url", BLOB, [failed(BLOB, 503)])).toBe("DECIDE");
  });

  it("photo du site : gardée si le fichier existe, décision sinon", () => {
    const exists = vi.fn((path: string) => path === "/img/products/rumsteak.jpg");
    const actions = planRepairs(
      [
        row("products", "image_url", "/img/products/rumsteak.jpg"),
        row("products", "image_url", "/img/products/absente.jpg"),
      ],
      new Map(),
      { localFileExists: exists }
    );
    expect(actions.map((action) => action.action)).toEqual(["SKIP", "DECIDE"]);
    expect(exists).toHaveBeenCalledWith("/img/products/absente.jpg");
  });

  it("stockage local de développement : gardé", () => {
    expect(act("products", "image_url", "/local-images/shops/a/product/x.webp")).toBe("SKIP");
  });
});

describe("planRepairs — copies", () => {
  it("une seule copie pour la photo d'un produit et la même dans ses photos (même boutique)", () => {
    const product = row("products", "image_url", UNSPLASH);
    const image = row("product_images", "url", UNSPLASH);
    expect(plan([product, image], [alive(UNSPLASH)])).toEqual([
      { action: "COPY", rows: [product, image], source: UNSPLASH },
    ]);
  });

  it("une copie par boutique pour une même source", () => {
    const a = row("products", "image_url", UNSPLASH, { shopId: "shop-a" });
    const b = row("products", "image_url", UNSPLASH, { shopId: "shop-b" });
    const c = row("products", "image_url", UNSPLASH, { shopId: "shop-a" });
    expect(plan([a, b, c], [alive(UNSPLASH)])).toEqual([
      { action: "COPY", rows: [a, c], source: UNSPLASH },
      { action: "COPY", rows: [b], source: UNSPLASH },
    ]);
  });

  it("autre magasin Blob et autre hôte https vivants : copiés", () => {
    const other = "https://cdn.example.com/a.jpg";
    const actions = plan(
      [
        row("campaigns", "visual_image_url", FOREIGN, { shopId: null }),
        row("site_banners", "image_url", other, { shopId: null }),
      ],
      [alive(FOREIGN), alive(other)]
    );
    expect(actions.map((action) => action.action)).toEqual(["COPY", "COPY"]);
  });

  it("source vivante dans le registre generated_images : décision, pas de second enregistrement", () => {
    expect(only("generated_images", "image_url", UNSPLASH, [alive(UNSPLASH)])).toMatchObject({
      action: "DECIDE",
      reason: expect.stringContaining("registre"),
    });
  });
});

describe("planRepairs — sources mortes et inconnues", () => {
  it("source disparue (404) : NULL pour un produit, décision pour une photo de produit", () => {
    const gone = [failed(UNSPLASH_DEAD, 404)];
    expect(act("products", "image_url", UNSPLASH_DEAD, gone)).toBe("NULL");
    expect(act("product_images", "url", UNSPLASH_DEAD, gone)).toBe("DECIDE");
  });

  it("sonde en échec pour une autre raison, ou absente : décision", () => {
    const notImage = only("products", "image_url", UNSPLASH, [
      failed(UNSPLASH, 200, "pas une image"),
    ]);
    expect(notImage).toMatchObject({ action: "DECIDE", reason: expect.stringContaining("image") });
    expect(act("products", "image_url", UNSPLASH, [failed(UNSPLASH, 503)])).toBe("DECIDE");
    expect(only("products", "image_url", UNSPLASH)).toMatchObject({
      action: "DECIDE",
      reason: expect.stringContaining("non sondée"),
    });
  });

  it("lien Replicate : mort même si la sonde répond, NULL ou décision selon la colonne", () => {
    expect(act("offers", "banner_image_url", REPLICATE, [alive(REPLICATE)])).toBe("NULL");
    expect(act("products", "image_url", REPLICATE)).toBe("NULL");
    expect(act("generated_images", "image_url", REPLICATE)).toBe("DECIDE");
  });

  it("ancien chemin /api/uploads : NULL pour un produit, décision pour une photo de produit", () => {
    expect(act("products", "image_url", LEGACY_UPLOAD)).toBe("NULL");
    expect(act("product_images", "url", LEGACY_UPLOAD)).toBe("DECIDE");
  });

  it("data:, blob: et valeur http : toujours une décision, même dans une colonne avec repli", () => {
    expect(act("products", "image_url", "data:image/png;base64,AAAA")).toBe("DECIDE");
    expect(act("products", "image_url", "blob:https://klikandgo.app/1")).toBe("DECIDE");
    expect(act("products", "image_url", "http://example.com/a.jpg")).toBe("DECIDE");
  });

  it("chaque ligne reçoit exactement une action", () => {
    const promo = "https://example.com/promo.png";
    const rows = [
      row("products", "image_url", BLOB),
      row("products", "image_url", UNSPLASH),
      row("product_images", "url", UNSPLASH),
      row("products", "image_url", UNSPLASH_DEAD),
      row("offers", "popup_image_url", promo),
      row("recipes", "image_url", "/img/recipes/tajine.jpg"),
    ];
    const actions = plan(rows, [alive(UNSPLASH), failed(UNSPLASH_DEAD, 404), failed(promo, 404)]);
    const covered = actions.flatMap((action) =>
      action.action === "COPY" ? action.rows : [action.row]
    );
    expect(covered.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it("une colonne hors inventaire est une erreur de programmation", () => {
    expect(() => only("products", "description", REPLICATE)).toThrow("Colonne d'image inconnue");
    expect(() => imageColumnOf("orders", "image_url")).toThrow();
  });
});

describe("gardes des scripts", () => {
  it("adresses sondées : https sur un hôte nommé public, sans port ni identifiants", () => {
    expect(isProbeableUrl(UNSPLASH)).toBe(true);
    expect(isProbeableUrl(BLOB)).toBe(true);
    const refused = [
      "http://images.unsplash.com/a.jpg",
      "https://images.unsplash.com:8443/a.jpg",
      "https://user:pw@images.unsplash.com/a.jpg",
      "https://127.0.0.1/a.jpg",
      "https://0x7f.1/a.jpg",
      "https://[::1]/a.jpg",
      "https://localhost/a.jpg",
      "https://api.localhost/a.jpg",
      "https://intranet/a.jpg",
      "/img/products/a.jpg",
      "data:image/png;base64,AA",
    ];
    for (const value of refused) expect(isProbeableUrl(value), value).toBe(false);
  });

  it("sources copiées : Unsplash, Pexels, magasins Blob, et les hôtes ajoutés seulement", () => {
    const other = "https://cdn.example.com/a.jpg";
    expect(isAllowedCopySource(UNSPLASH, [])).toBe(true);
    expect(isAllowedCopySource("https://images.pexels.com/photos/1/a.jpeg", [])).toBe(true);
    expect(isAllowedCopySource(FOREIGN, [])).toBe(true);
    expect(isAllowedCopySource(other, [])).toBe(false);
    expect(isAllowedCopySource(other, ["CDN.example.com"])).toBe(true);
    expect(isAllowedCopySource("https://127.0.0.1/a.jpg", ["127.0.0.1"])).toBe(false);
  });

  it("seules les sources https copiables sont sondées", () => {
    expect(needsSourceProbe({ kind: "LEGACY_DISPLAY", value: UNSPLASH })).toBe(true);
    expect(needsSourceProbe({ kind: "OTHER", value: "https://example.com/a.png" })).toBe(true);
    expect(needsSourceProbe({ kind: "OTHER", value: "http://example.com/a.png" })).toBe(false);
    expect(needsSourceProbe({ kind: "BLOB", value: BLOB })).toBe(false);
    expect(needsSourceProbe({ kind: "EXPIRING", value: REPLICATE })).toBe(false);
  });

  it("usage du registre : PRODUCT pour les photos d'aliments, BANNER pour les visuels", () => {
    const usage = (column: (typeof IMAGE_COLUMNS)[number]) => registryUsageFor(column.table);
    const byColumn = Object.fromEntries(
      IMAGE_COLUMNS.map((c) => [`${c.table}.${c.column}`, usage(c)])
    );
    expect(byColumn).toMatchObject({
      "products.image_url": "PRODUCT",
      "product_images.url": "PRODUCT",
      "categories.image_url": "PRODUCT",
      "reference_products.image_url": "PRODUCT",
      "reference_product_images.url": "PRODUCT",
      "recipes.image_url": "PRODUCT",
      "shops.image_url": "BANNER",
      "shops.halal_cert_url": "BANNER",
      "offers.popup_image_url": "BANNER",
      "campaigns.visual_image_url": "BANNER",
      "site_banners.image_url": "BANNER",
    });
  });

  it("base locale : localhost, 127.0.0.1 ou ::1, paramètre host compris", () => {
    expect(isLocalDatabaseUrl("postgresql://ci:ci@127.0.0.1:55433/ci_photos_kit")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u@localhost/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u@[::1]:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u@switchyard.proxy.rlwy.net:5432/railway")).toBe(false);
    expect(isLocalDatabaseUrl("postgresql://u@localhost/db?host=db.example.com")).toBe(false);
    expect(isLocalDatabaseUrl("mysql://u@localhost/db")).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
  });

  it("écriture permise avec le magasin Blob, ou en local avec le disque ; refusée sinon", () => {
    const remote = "postgresql://u@switchyard.proxy.rlwy.net/railway";
    expect(applyRefusal("blob", remote)).toBeNull();
    expect(applyRefusal("local", "postgresql://ci:ci@127.0.0.1:55433/ci")).toBeNull();
    expect(applyRefusal("local", remote)).toContain("BLOB_READ_WRITE_TOKEN");
  });
});
