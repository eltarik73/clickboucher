// Frontières de dépendances de Klik&Go, en lecture seule (n'est PAS chargé par `npm run lint`).
// Lancer depuis la racine du dépôt :
//   node .claude/skills/architecture-conventions/scripts/check-boundaries.mjs
// Contenu prévu pour être recopié dans .eslintrc.json une fois la dette listée ramenée à zéro.
// Vérifié le 2026-11-14 sur un mini-projet de synthèse : chaque zone ci-dessous lève bien une
// erreur (lib → UI, composant → route, espace → autre espace dans les deux sens, service → auth,
// service → next/*, cycle a ↔ b) et un import d'un dossier parent de la même route n'en lève pas.
const path = require("node:path");
const root = process.cwd();
const fromRoot = (id) => require.resolve(id, { paths: [root] });
const parser = fromRoot("@typescript-eslint/parser");

// Espaces de routes de src/app : aucun n'importe un fichier d'un autre (ni d'un fichier posé
// directement dans src/app). Les dossiers SEO de premier niveau (boucherie-halal, …) ne sont pas
// listés : ajouter ici tout nouvel espace qui grossit.
const ROUTE_SPACES = ["(boucher)", "(client)", "(admin)", "(auth)", "webmaster", "api"];

module.exports = {
  root: true,
  plugins: ["import"],
  parser,
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: {
    "import/parsers": { [parser]: [".ts", ".tsx"] },
    "import/resolver": {
      [fromRoot("eslint-import-resolver-typescript")]: { project: path.join(root, "tsconfig.json") },
    },
  },
  rules: {
    // Aucun cycle d'import dans src/ au 2026-11-14 : le garder ainsi.
    "import/no-cycle": ["error", { ignoreExternal: true }],
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            // src/lib/hooks et src/lib/__tests__ sont exclus : hooks client et tests y vivent.
            target: [
              "./src/lib/*.ts",
              "./src/lib/{api,auth,cart,emails,marketing,pricing,seo,services,validations,validators}/**",
            ],
            from: ["./src/app", "./src/components", "./src/hooks"],
            message: "src/lib ne dépend jamais de l'UI ni des routes.",
          },
          {
            target: ["./src/components", "./src/hooks"],
            from: "./src/app",
            message: "Composants et hooks partagés ne dépendent pas d'une route.",
          },
          ...ROUTE_SPACES.map((space) => ({
            target: `./src/app/${space}`,
            from: "./src/app",
            except: [`./${space}`],
            message: "Pas d'import entre espaces de routes : remonter le code partagé dans src/components/<domaine>.",
          })),
          {
            target: ["./src/lib/services", "./src/lib/pricing", "./src/lib/cart", "./src/lib/validators"],
            from: ["./src/lib/boucher-auth.ts", "./src/lib/admin-auth.ts", "./src/lib/auth/server-auth.ts"],
            message: "Un service reçoit l'identité en paramètre ; l'authentification reste dans la route.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // `import type` compris : un service ne prend même pas NextRequest en paramètre.
      files: ["src/lib/services/**", "src/lib/pricing/**", "src/lib/cart/**", "src/lib/validators/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["next/server", "next/headers", "next/navigation"],
                message: "Couche domaine : pas d'objet HTTP Next ; la route traduit.",
              },
            ],
          },
        ],
      },
    },
  ],
};
