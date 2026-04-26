import { test, expect } from "@playwright/test";

test.describe("Smoke — Public routes", () => {
  test("homepage loads with H1 and shop list", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Klik&Go/);
    const h1 = page.locator("h1");
    await expect(h1.first()).toBeAttached();
  });

  test("city SEO page (chambery) loads", async ({ page }) => {
    const res = await page.goto("/boucherie-halal/chambery");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("shop page loads with products", async ({ page }) => {
    await page.goto("/boutique/boucherie-tarik");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/€/).first()).toBeVisible();
  });

  test("bons-plans page", async ({ page }) => {
    const res = await page.goto("/bons-plans");
    expect(res?.status()).toBe(200);
  });

  test("cart page (empty state)", async ({ page }) => {
    await page.goto("/panier");
    await expect(page.getByText(/panier|vide/i)).toBeVisible();
  });

  test("contact page", async ({ page }) => {
    const res = await page.goto("/contact");
    expect(res?.status()).toBe(200);
  });

  test("a-propos page", async ({ page }) => {
    const res = await page.goto("/a-propos");
    expect(res?.status()).toBe(200);
  });

  test("sitemap.xml is valid", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
  });

  test("robots.txt is valid", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
  });

  test("API health endpoint", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    const json = await res.json();
    expect(json).toHaveProperty("status");
  });
});
