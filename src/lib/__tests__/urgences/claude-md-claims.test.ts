// @vitest-environment node
// Garde sur CLAUDE.md, que lit chaque agent du programme. Régressions attrapées : le retour d'une
// affirmation fausse relevée par l'audit de qualité du 2026-11-15 (LIS-02, ARCH-16 : routes, fonction,
// pages ou composants qui n'existent pas, chiffres périmés), la perte d'une décision du propriétaire
// du 2026-11-15, une consigne de pousser sur main, et tout chemin `src/…` ou `prisma/…` cité qui
// n'existe pas sur disque.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CLAUDE_MD = readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");

/**
 * Chemins de dépôt cités entre accents graves et commençant par src/ ou prisma/. Un motif ou un
 * gabarit (`src/lib/pricing/*`, `src/lib/**`, `shop:v2:<slug>`) est coupé avant son premier segment
 * générique : seul le dossier réel qui le précède doit exister.
 */
function citedRepositoryPaths(markdown: string): string[] {
  const spans = Array.from(markdown.matchAll(/`([^`\n]+)`/g), (match) => match[1]);
  const paths = spans
    .filter((span) => /^(src|prisma)\//.test(span))
    .map((span) => {
      const segments: string[] = [];
      for (const segment of span.split(/\s/)[0].split("/")) {
        if (/[*<{]/.test(segment)) break;
        segments.push(segment);
      }
      return segments.join("/");
    });
  return Array.from(new Set(paths));
}

describe("CLAUDE.md : affirmations fausses retirées (audit du 2026-11-15)", () => {
  it.each([
    ["/api/boucher/promo-codes", "route supprimée en mars 2026"],
    ["/api/webmaster/promo-codes", "route supprimée en mars 2026"],
    ["processLoyaltyOnPickup", "fonction inexistante, aucune récompense n'est créée"],
    ["/webmaster/fidelite", "page inexistante"],
    ["/boucher/dashboard/promos", "page inexistante"],
    ["6 villes", "SEO_CITIES compte plus de 6 villes"],
    ["(v9)", "étiquette de version périmée"],
    ["test:ui", "@vitest/ui n'est pas installé"],
    ["CartDrawer", "composant sans importeur"],
    ["CartPanel", "composant sans importeur"],
    ["CartFAB", "composant sans importeur"],
    ["Audit Prod (Mars 2026)", "instantané périmé"],
    ["useOrderStream", "hook supprimé avec le flux SSE"],
    ["Programmées (en attente)", "la section s'appelle « Précommandes »"],
    ["4 colonnes", "la cuisine a 3 colonnes sur grand écran, 4 onglets sur mobile"],
    ["Output standalone pour Vercel", "standalone seulement hors Vercel"],
    ["getProductImage.ts", "fichier inexistant, les modules de src/lib sont en kebab-case"],
    ["OrderTimeline", "composant inexistant"],
    ["CalendarBanner", "composant sans importeur"],
    ["client a 5 min", "palier 2 : 30 s par défaut ; palier 3 : jamais validé automatiquement"],
    ["git push main", "main est protégée : fusion d'une pull request"],
    ["add/commit/push sans demander", "jamais de push sur main"],
    ["Node 20", "CI, .nvmrc et engines de package.json sont en Node 22 depuis 1824d4f"],
  ])("ne contient plus « %s » (%s)", (claim) => {
    expect(CLAUDE_MD).not.toContain(claim);
  });
});

describe("CLAUDE.md : faits vérifiés et décisions du propriétaire du 2026-11-15", () => {
  it.each([
    "src/lib/cart/stored-cart.ts",
    "Précommandes",
    "shop:v2:",
    "src/lib/commercial-emails.ts",
    "Décisions du propriétaire (2026-11-15)",
    "Node 22",
    "Branche `main` protégée",
    "1 234,56 €",
    "src/hooks/use-pending-order-count.ts",
  ])("contient « %s »", (fact) => {
    expect(CLAUDE_MD).toContain(fact);
  });

  it("place la section des décisions du propriétaire juste avant « Permissions »", () => {
    const sections = Array.from(CLAUDE_MD.matchAll(/^## (.+)$/gm), (match) => match[1]);
    const permissions = sections.indexOf("Permissions");

    expect(permissions).toBeGreaterThan(0);
    expect(sections[permissions - 1]).toBe("Décisions du propriétaire (2026-11-15)");
  });
});

describe("CLAUDE.md : chemins cités", () => {
  it("chaque chemin src/… ou prisma/… cité entre accents graves existe", () => {
    const cited = citedRepositoryPaths(CLAUDE_MD);
    const missing = cited.filter((cite) => !existsSync(path.join(ROOT, cite)));

    expect(cited.length).toBeGreaterThan(50);
    expect(missing).toEqual([]);
  });
});
