// Make this file a module to avoid global scope conflicts with other scripts
export {};

/**
 * Audit quotidien Bing Webmaster Tools API.
 *
 * Stats + crawl issues + recommandations + submit URLs au besoin.
 * Output dans /tmp/bing-audit-YYYY-MM-DD.json + log console.
 *
 * Lance manuellement :
 *   npx tsx scripts/bing-daily-audit.ts
 *
 * Ou via cron (cf project_gsc_indexation_strategy.md).
 *
 * Pré-requis :
 *   - BING_WEBMASTER_API_KEY dans .env.local (ou Vercel env vars)
 *
 * Source API : https://learn.microsoft.com/en-us/bingwebmaster/
 */

const SITE_URL = "https://klikandgo.app";
const API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
const API_KEY = process.env.BING_WEBMASTER_API_KEY;

if (!API_KEY) {
  console.error("BING_WEBMASTER_API_KEY manquant dans env");
  process.exit(1);
}

type CrawlStats = {
  Date: string;
  CrawledPages: number;
  Code2xx: number;
  Code301: number;
  Code4xx: number;
  Code5xx: number;
  CrawlErrors: number;
  InIndex: number;
  BlockedByRobotsTxt: number;
};

type CrawlIssue = {
  Url: string;
  IssueDescription: string;
};

async function callApi<T>(method: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({
    siteUrl: SITE_URL,
    apikey: API_KEY!,
    ...params,
  }).toString();
  const url = `${API_BASE}/${method}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bing API ${method} failed: ${res.status}`);
  const data = await res.json();
  return data.d as T;
}

async function main() {
  console.log(`\n=== Bing Webmaster Audit ${new Date().toISOString().split("T")[0]} ===\n`);

  // 1. Crawl stats
  const stats = await callApi<CrawlStats[]>("GetCrawlStats");
  const latest = stats[0];
  console.log("📊 Crawl Stats (jour le plus récent) :");
  console.log(`  • Crawled pages : ${latest.CrawledPages}`);
  console.log(`  • In index      : ${latest.InIndex}`);
  console.log(`  • 2xx           : ${latest.Code2xx}`);
  console.log(`  • 301           : ${latest.Code301}`);
  console.log(`  • 4xx           : ${latest.Code4xx} ⚠️`);
  console.log(`  • 5xx           : ${latest.Code5xx} 🔴`);
  console.log(`  • Crawl errors  : ${latest.CrawlErrors}`);
  console.log(`  • Blocked robots: ${latest.BlockedByRobotsTxt}`);

  // 2. Crawl issues
  const issues = await callApi<CrawlIssue[]>("GetCrawlIssues");
  console.log(`\n🔍 Crawl Issues (${issues.length}) :`);
  if (issues.length === 0) {
    console.log("  ✅ Aucune");
  } else {
    issues.slice(0, 10).forEach((i) => {
      console.log(`  • [${i.IssueDescription}] ${i.Url}`);
    });
    if (issues.length > 10) console.log(`  ... +${issues.length - 10} autres`);
  }

  // 3. URL info sur la homepage
  try {
    const urlInfo = await callApi<unknown>("GetUrlInfo", { url: SITE_URL + "/" });
    console.log(`\n🏠 Homepage info : ${JSON.stringify(urlInfo, null, 2).slice(0, 500)}`);
  } catch (e) {
    console.log(`\n🏠 Homepage info : erreur (${(e as Error).message})`);
  }

  // 4. Quota submit URLs
  try {
    const quota = await callApi<{ DailyQuota: number; MonthlyQuota: number }>(
      "GetUrlSubmissionQuota"
    );
    console.log(`\n📤 Submit URL quota : ${quota.DailyQuota}/jour, ${quota.MonthlyQuota}/mois`);
  } catch (e) {
    console.log(`\n📤 Quota : erreur`);
  }

  // 5. Output JSON
  const today = new Date().toISOString().split("T")[0];
  const out = { date: today, latest, issues };
  const outPath = `/tmp/bing-audit-${today}.json`;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n💾 Output : ${outPath}`);
}

main().catch((e) => {
  console.error("Erreur :", e);
  process.exit(1);
});
