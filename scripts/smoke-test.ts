// Make this file a module to avoid global scope conflicts with other scripts
export {};

/**
 * 🧪 KLIK&GO — Smoke Test Script
 * Verifies all pages and API routes respond correctly.
 *
 * Usage: npx tsx scripts/smoke-test.ts [base-url]
 * Default URL: http://localhost:3000
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";

interface TestResult {
  url: string;
  method: string;
  status: number;
  ok: boolean;
  redirectUrl?: string;
  error?: string;
}

async function testUrl(
  path: string,
  method = "GET",
  expectedStatuses = [200, 302, 307, 308]
): Promise<TestResult> {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method,
      redirect: "manual",
      headers: { "User-Agent": "KlikGo-SmokeTest/1.0" },
    });

    const ok = expectedStatuses.includes(res.status);
    const redirectUrl =
      res.status >= 300 && res.status < 400 ? res.headers.get("location") || undefined : undefined;

    return { url: path, method, status: res.status, ok, redirectUrl };
  } catch (error) {
    return {
      url: path,
      method,
      status: 0,
      ok: false,
      error: (error as Error).message,
    };
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════");
  console.log("🧪 SMOKE TEST — Toutes les pages");
  console.log(`🌐 URL: ${BASE_URL}`);
  console.log("═══════════════════════════════════════\n");

  // ── Pages ──
  const pages = [
    { path: "/", label: "Accueil" },
    { path: "/decouvrir", label: "Découvrir" },
    { path: "/sign-in", label: "Connexion" },
    { path: "/sign-up", label: "Inscription" },
    { path: "/panier", label: "Panier" },
    { path: "/commandes", label: "Commandes client (auth)" },
    { path: "/favoris", label: "Favoris" },
    { path: "/profil", label: "Profil (auth)" },
    { path: "/bons-plans", label: "Bons plans" },
    { path: "/espace-boucher", label: "Espace boucher" },
    { path: "/boucher/dashboard", label: "Dashboard boucher" },
    { path: "/boucher/commandes", label: "Mode cuisine" },
    { path: "/boucher/produits", label: "Produits boucher" },
    { path: "/boucher/clients", label: "Clients boucher" },
    { path: "/boucher/parametres", label: "Paramètres boucher" },
    { path: "/boucher/support", label: "Support boucher" },
  ];

  // Routes that require Clerk auth — accept 401/404 as valid (Clerk blocks without session)
  const authPages = ["/commandes", "/profil", "/checkout"];

  console.log("📄 PAGES\n");
  const pageResults: TestResult[] = [];
  for (const page of pages) {
    const isAuthPage = authPages.some((p) => page.path.startsWith(p));
    const expected = isAuthPage ? [200, 302, 307, 308, 401, 404] : [200, 302, 307, 308];
    const result = await testUrl(page.path, "GET", expected);
    pageResults.push(result);

    const icon = result.ok ? "✅" : "❌";
    const redirect = result.redirectUrl ? ` → ${result.redirectUrl}` : "";
    const err = result.error ? ` (${result.error})` : "";
    console.log(
      `   ${icon} ${result.status || "ERR"} ${page.label} (${page.path})${redirect}${err}`
    );
  }

  // ── API Routes ──
  const apis = [
    { path: "/api/health", label: "Health check" },
    { path: "/api/shops", label: "Liste boutiques" },
    { path: "/api/search?q=test", label: "Recherche" },
  ];

  const authApis = [
    { path: "/api/boucher/shop/status", label: "Statut boutique (auth)" },
    { path: "/api/boucher/products", label: "Produits boucher (auth)" },
    { path: "/api/boucher/dashboard/stats", label: "Stats dashboard (auth)" },
    { path: "/api/notifications", label: "Notifications (auth)" },
    { path: "/api/users/me", label: "Profil user (auth)" },
  ];

  console.log("\n🔌 API ROUTES (publiques)\n");
  const apiResults: TestResult[] = [];
  for (const api of apis) {
    const result = await testUrl(api.path);
    apiResults.push(result);

    const icon = result.ok ? "✅" : "❌";
    console.log(`   ${icon} ${result.status || "ERR"} ${api.label}`);
  }

  console.log("\n🔐 API ROUTES (nécessitent auth — 401 attendu)\n");
  for (const api of authApis) {
    const result = await testUrl(api.path, "GET", [200, 401, 403]);
    apiResults.push(result);

    const icon = result.ok ? "✅" : "❌";
    console.log(`   ${icon} ${result.status || "ERR"} ${api.label}`);
  }

  // ── Summary ──
  const allResults = [...pageResults, ...apiResults];
  const okCount = allResults.filter((r) => r.ok).length;
  const failCount = allResults.filter((r) => !r.ok).length;

  console.log("\n═══════════════════════════════════════");
  console.log(`📊 RÉSULTAT SMOKE TEST`);
  console.log(`   ✅ Pages/API OK : ${okCount}/${allResults.length}`);
  if (failCount > 0) {
    console.log(`   ❌ Échecs : ${failCount}`);
    const failures = allResults.filter((r) => !r.ok);
    for (const f of failures) {
      console.log(`      - ${f.url} : ${f.status || "ERR"} ${f.error || ""}`);
    }
  }
  console.log("═══════════════════════════════════════\n");

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("💥 Erreur fatale :", e);
  process.exit(1);
});
