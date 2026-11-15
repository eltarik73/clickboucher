// @vitest-environment node
// Garde sur la documentation d'installation et sur l'ordre des instructions de prisma/seed.ts.
// Régressions attrapées : README.md et DEPLOY.md ont prescrit `prisma db seed` contre la base de
// production (le seed vide 26 tables) ; l'installation locale passait par `prisma migrate dev`,
// alors que la CI et les voies locales créent le schéma par `prisma db push` ; un seed qui viderait
// une table avant d'avoir vérifié sa cible ; Node.js 18 encore prescrit après la décision du
// propriétaire du 2026-11-15 (Node 22).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), "utf8");

const SEED_COMMAND = /prisma db seed|db:seed/;
const PRODUCTION_HEADING = /production|d[ée]ploiement|railway|vercel/i;

interface SeedLine {
  line: number;
  text: string;
  headings: string[];
}

/**
 * Lignes qui lancent le seed, avec les titres de section (niveaux 2 et plus) sous lesquels elles
 * se trouvent. Le titre de niveau 1 est celui du document (« Déploiement… » pour DEPLOY.md) : il
 * n'indique pas la section. Les blocs de code sont lus comme du texte, leurs `#` ne sont pas des titres.
 */
function seedLines(markdown: string): SeedLine[] {
  const stack: { level: number; title: string }[] = [];
  const found: SeedLine[] = [];
  let inFence = false;
  markdown.split("\n").forEach((text, index) => {
    if (/^\s*```/.test(text)) {
      inFence = !inFence;
      return;
    }
    const heading = inFence ? null : /^(#{2,6})\s+(.*)$/.exec(text);
    if (heading) {
      const level = heading[1].length;
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title: heading[2] });
      return;
    }
    if (SEED_COMMAND.test(text))
      found.push({ line: index + 1, text, headings: stack.map((h) => h.title) });
  });
  return found;
}

/** URL de la base que docker-compose.yml démarre, lue dans le fichier (utilisateur, mot de passe, base, port publié). */
function composeDatabaseUrl(): string {
  const compose = read("docker-compose.yml");
  const value = (key: string): string => {
    const match = new RegExp(`${key}:\\s*(\\S+)`).exec(compose);
    if (!match) throw new Error(`${key} absent de docker-compose.yml`);
    return match[1];
  };
  const port = /-\s*"(\d+):5432"/.exec(compose);
  if (!port) throw new Error("port PostgreSQL publié absent de docker-compose.yml");
  return `postgresql://${value("POSTGRES_USER")}:${value("POSTGRES_PASSWORD")}@localhost:${port[1]}/${value("POSTGRES_DB")}`;
}

describe.each(["README.md", "DEPLOY.md"])("%s", (file) => {
  const markdown = read(file);

  it("donne le DATABASE_URL de la base que docker-compose.yml démarre", () => {
    expect(markdown).toContain(`DATABASE_URL="${composeDatabaseUrl()}?schema=public"`);
  });

  it("ne lance jamais le seed dans une section de production ou de déploiement", () => {
    const inProduction = seedLines(markdown).filter((seed) =>
      seed.headings.some((title) => PRODUCTION_HEADING.test(title))
    );
    expect(inProduction).toEqual([]);
  });

  it("décrit l'installation locale : docker compose, prisma db push, puis le seed", () => {
    const compose = markdown.indexOf("docker compose up -d");
    const push = markdown.indexOf("npx prisma db push", compose);
    const seed = markdown.indexOf("npm run db:seed", push);
    expect(compose).toBeGreaterThanOrEqual(0);
    expect(push).toBeGreaterThan(compose);
    expect(seed).toBeGreaterThan(push);
  });

  it("n'utilise pas prisma migrate dev", () => {
    expect(markdown).not.toMatch(/migrate dev/);
  });

  it("demande Node.js 22 et aucune autre version", () => {
    expect([...new Set(markdown.match(/Node\.js \d+/g))]).toEqual(["Node.js 22"]);
  });
});

describe("setup.sh", () => {
  const script = read("setup.sh");

  it("crée la base locale par docker compose, prisma db push, puis le seed", () => {
    const compose = script.indexOf("docker compose up -d");
    const push = script.indexOf("npx prisma db push", compose);
    const seed = script.indexOf("npm run db:seed", push);
    expect(compose).toBeGreaterThanOrEqual(0);
    expect(push).toBeGreaterThan(compose);
    expect(seed).toBeGreaterThan(push);
  });

  it("n'utilise pas prisma migrate dev", () => {
    expect(script).not.toMatch(/migrate dev/);
  });

  it("refuse un Node.js de version majeure inférieure à 22", () => {
    expect(script).toContain('if [ "$NODE_VERSION" -lt 22 ]; then');
    expect(script).not.toMatch(/Node\.js 18|-lt 18/);
  });
});

describe("prisma/seed.ts", () => {
  it("vérifie sa cible avant de vider la première table", () => {
    const seed = read("prisma/seed.ts");
    const guard = seed.indexOf("seedTargetIssue(process.env.DATABASE_URL)");
    const firstDelete = seed.indexOf(".deleteMany(");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(firstDelete);
  });
});
