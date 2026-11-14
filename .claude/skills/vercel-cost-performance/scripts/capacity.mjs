#!/usr/bin/env node
/**
 * capacity.mjs — modèle de capacité Vercel pour Klik&Go (ordre de grandeur, pas une facture).
 *
 * Usage :
 *   node .claude/skills/vercel-cost-performance/scripts/capacity.mjs [cle=valeur ...]
 *   node .claude/skills/vercel-cost-performance/scripts/capacity.mjs shops=10 kitchenHours=10 ordersPerDay=25
 *   node .claude/skills/vercel-cost-performance/scripts/capacity.mjs --help
 *
 * Toutes les valeurs par défaut sont des HYPOTHÈSES (cf. references/mesure-et-capacite.md).
 * Remplacer les temps CPU par les mesures d'Observability dès qu'elles existent.
 * Tarifs et quotas : documentation Vercel lue le 2026-11-13 (references/sources.md, S2, S3, S30).
 */
const DEFAULTS = {
  days: 30,
  // Trafic
  shops: 1, // boutiques avec une tablette « Mode Cuisine » ouverte
  kitchenHours: 10, // heures par jour, onglet visible
  kitchenPollSec: 5, // use-order-polling.ts
  kitchenHiddenHours: 0, // heures par jour, onglet ouvert mais caché (tablette en veille, autre onglet)
  kitchenHiddenPollSec: 15, // HIDDEN_INTERVAL_MS de use-order-polling.ts : la boucle ralentit, elle ne s'arrête pas
  ordersPerDay: 20, // commandes par boutique et par jour
  trackingMin: 20, // minutes de suivi client par commande (polling 5 s, onglet visible)
  trackingPollSec: 5,
  anonViews: 3000, // pages vues anonymes avec JS, par mois
  apiPerView: 2, // appels API par page vue anonyme (2 sur la home après correctifs)
  botHits: 60000, // requêtes de robots sur des pages, par mois
  dynamicShare: 0.15, // part des hits robots sur une route rendue par requête (/boutique/[slug])
  isrRegenShare: 0.2, // part des hits robots sur une page ISR périmée (régénération)
  crons: 15, // exécutions de cron par jour
  // CPU actif par invocation, en ms (mesures locales audit 2026-11 : middleware 46-54 froid, 0,2-0,4 chaud)
  mwCold: 50,
  mwWarm: 0.4,
  fnCold: 300, // cold require : @sentry/nextjs 209 + Clerk 56 + Prisma 20
  fnWarm: 15,
  renderMs: 120, // rendu serveur d'une page (hors cold start)
  coldPoll: 0.02, // part de cold starts pour un polling régulier (instance tenue chaude)
  coldSparse: 0.8, // part de cold starts pour un trafic clairsemé (robots, visites isolées)
  // Mémoire provisionnée
  wallMs: 250, // durée murale moyenne d'une invocation (attente DB comprise)
  memGb: 2, // défaut Hobby et Pro
  // Tarifs Pro à la demande (USD) : identiques pour sfo1 et cdg1 sur le CPU
  cpuRate: 0.177, // par heure de CPU actif
  memRate: 0.0147, // par GB-heure
  invRate: 0.6, // par million d'invocations
  // Quotas Hobby (par mois, partagés par TOUS les projets de l'équipe)
  hobbyCpuH: 4,
  hobbyMemGbH: 360,
  hobbyInv: 1_000_000,
};

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(`Paramètres (cle=valeur) et valeurs par défaut :\n${Object.entries(DEFAULTS).map(([k, v]) => `  ${k}=${v}`).join("\n")}\n`);
  process.exit(0);
}
const p = { ...DEFAULTS };
for (const arg of args) {
  const [key, raw] = arg.split("=");
  if (!(key in p) || raw === undefined || Number.isNaN(Number(raw))) {
    process.stderr.write(`Paramètre inconnu ou non numérique : ${arg} (voir --help)\n`);
    process.exit(2);
  }
  p[key] = Number(raw);
}

const cpu = (count, cold, coldMs, warmMs) => (count * (cold * coldMs + (1 - cold) * warmMs)) / 1000; // secondes
const mem = (count) => (count * (p.wallMs / 1000) * p.memGb) / 3600; // GB-heures

/** Chaque ligne : appels, passage par le middleware, exécution d'une fonction, part de cold starts, CPU de rendu. */
const kitchenCalls =
  (p.shops * p.kitchenHours * 3600 * p.days) / p.kitchenPollSec +
  (p.shops * p.kitchenHiddenHours * 3600 * p.days) / p.kitchenHiddenPollSec;
const trackingCalls = (p.shops * p.ordersPerDay * p.trackingMin * 60 * p.days) / p.trackingPollSec;
const rows = [
  { name: "Mode Cuisine (polling)", calls: kitchenCalls, mw: true, cold: p.coldPoll, extra: 0 },
  { name: "Suivi commande client", calls: trackingCalls, mw: true, cold: p.coldPoll, extra: 0 },
  { name: "API vues anonymes", calls: p.anonViews * p.apiPerView, mw: false, cold: p.coldSparse, extra: 0 },
  { name: "Robots → pages dynamiques", calls: p.botHits * p.dynamicShare, mw: false, cold: p.coldSparse, extra: p.renderMs },
  { name: "Robots → régénérations ISR", calls: p.botHits * (1 - p.dynamicShare) * p.isrRegenShare, mw: false, cold: p.coldSparse, extra: p.renderMs },
  { name: "Crons", calls: p.crons * p.days, mw: false, cold: 1, extra: 0 },
].map((r) => {
  const fnCpu = cpu(r.calls, r.cold, p.fnCold + r.extra, p.fnWarm + r.extra);
  const mwCpu = r.mw ? cpu(r.calls, r.cold, p.mwCold, p.mwWarm) : 0;
  return { ...r, fnInv: r.calls, mwInv: r.mw ? r.calls : 0, cpuS: fnCpu + mwCpu, memGbH: mem(r.calls) };
});

const sum = (key) => rows.reduce((total, r) => total + r[key], 0);
const cpuH = sum("cpuS") / 3600;
const memGbH = sum("memGbH");
const fnInv = sum("fnInv");
const fmt = (n, digits = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (value, quota) => `${fmt((100 * value) / quota)} %`;

process.stdout.write(`Modèle de capacité — ${p.days} jours, ${p.shops} boutique(s) active(s)\n\n`);
process.stdout.write(`${"Source".padEnd(30)}${"Fonctions".padStart(12)}${"Middleware".padStart(12)}${"CPU (min)".padStart(11)}${"Mém. GB-h".padStart(11)}\n`);
for (const r of rows) {
  process.stdout.write(`${r.name.padEnd(30)}${fmt(r.fnInv).padStart(12)}${fmt(r.mwInv).padStart(12)}${fmt(r.cpuS / 60, 1).padStart(11)}${fmt(r.memGbH, 1).padStart(11)}\n`);
}
process.stdout.write(`${"TOTAL".padEnd(30)}${fmt(fnInv).padStart(12)}${fmt(sum("mwInv")).padStart(12)}${fmt(cpuH * 60, 1).padStart(11)}${fmt(memGbH, 1).padStart(11)}\n\n`);

process.stdout.write(`Hobby (quotas d'équipe) : CPU actif ${fmt(cpuH, 2)} h / ${p.hobbyCpuH} h (${pct(cpuH, p.hobbyCpuH)}) · mémoire ${fmt(memGbH)} / ${p.hobbyMemGbH} GB-h (${pct(memGbH, p.hobbyMemGbH)}) · invocations ${fmt(fnInv)} / ${fmt(p.hobbyInv)} (${pct(fnInv, p.hobbyInv)})\n`);
const over = cpuH > p.hobbyCpuH || memGbH > p.hobbyMemGbH || fnInv > p.hobbyInv;
process.stdout.write(over ? "  → DÉPASSEMENT : sur Hobby le projet est coupé (402) jusqu'à 30 jours.\n" : "  → sous les quotas, si aucun autre projet de l'équipe ne consomme.\n");
const cost = cpuH * p.cpuRate + memGbH * p.memRate + (fnInv / 1e6) * p.invRate;
process.stdout.write(`Pro (à la demande, avant crédit mensuel de 20 $) : CPU ${fmt(cpuH * p.cpuRate, 2)} $ + mémoire ${fmt(memGbH * p.memRate, 2)} $ + invocations ${fmt((fnInv / 1e6) * p.invRate, 2)} $ = ${fmt(cost, 2)} $ / mois\n`);
process.stdout.write("Mémoire = majorant : en Fluid compute les requêtes simultanées partagent une instance, facturée une seule fois.\n");
process.stdout.write("Non comptés : requêtes CDN, transfert, lectures/écritures ISR, images, connexions longues (SSE), autres projets de l'équipe.\n");
process.stdout.write("Hypothèse non vérifiée : les invocations du middleware ne sont pas ajoutées au quota « Function Invocations ».\n");
