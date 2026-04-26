# Prisma v5 → v6 Migration Audit

Date : 2026-04-26
Backlog : item #21

## Décision : MIGRÉ vers v6.19.2 (conservative)

- **Avant** : `prisma@^5.14.0` / `@prisma/client@^5.14.0`
- **Après** : `prisma@6.19.2` / `@prisma/client@6.19.2`
- **Generator conservé** : `prisma-client-js` (PAS le nouveau `prisma-client` v6 qui exigerait un refactor de tous les imports — 202 fichiers)
- **Tests** : 133/133 passés
- **TypeScript** : `npx tsc --noEmit` clean
- **Prisma generate** : OK

> Note : `npm view prisma version` retourne déjà **7.8.0**. Skip volontaire de v7 (trop récent, ESM-only sur certains packages, breaking changes additionnels). v6.19.2 = dernière patch stable v6, sweet spot risque/perf.

## Évaluation des breaking changes v6 (impact projet)

| Breaking change | Impact Klik&Go | Statut |
|---|---|---|
| Node.js minimum 18.18 | On est sur Node v22 | OK |
| `Buffer` → `Uint8Array` (Bytes fields) | Aucun champ `Bytes` au schema | OK |
| `$use` middleware retiré | Aucun usage | OK |
| `NotFoundError` retiré | Aucun import | OK |
| Implicit M2M : règles plus strictes | 61 `@relation` explicites au schema | OK |
| Full-text search → preview obligatoire | Pas de FTS Prisma | OK |
| Nouveau generator `prisma-client` (opt-in) | Non adopté (refactor lourd, ROI faible) | Reporté |
| Types `Decimal` runtime | Aucun champ `Decimal` | OK |

## Surface impactée

- 202 fichiers `.ts/.tsx` utilisant `prisma.` ou `Prisma.`
- Singleton unique : `src/lib/prisma.ts` (pattern correct, conservé tel quel)
- 1 usage de `PrismaClientKnownRequestError` (toujours supporté en v6)
- 19 champs `Json` (compatible)

## Roadmap future (v7 ou nouveau generator)

À envisager Q3 2026 quand v7 sera mature :

1. **v6 → v7** : tester ESM compatibility (Vercel + Next.js 14 standalone build)
2. **Nouveau generator `prisma-client`** : output dans `src/generated/prisma`, refactor de ~202 imports `@prisma/client` (codemod possible). Bénéfice : -30% bundle Prisma Client, types plus rapides.
3. Vérifier que les preview features qu'on n'utilise pas (driverAdapters, etc.) restent inutiles.

## Commandes exécutées

```bash
npm install prisma@6.19.2 @prisma/client@6.19.2
npx prisma generate    # OK — Generated Prisma Client (v6.19.2)
npx tsc --noEmit       # OK — 0 erreur
npx vitest run         # OK — 133/133
```

## Fichiers modifiés

- `package.json` : versions Prisma bump 5.14.0 → 6.19.2
- `package-lock.json` : régénéré
- `prisma/schema.prisma` : **non modifié** (generator/datasource compatibles)
- Aucun fichier source modifié
