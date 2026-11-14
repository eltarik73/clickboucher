# Motifs de code vérifiés

Chaque bloc a été compilé le 2026-11-13 avec le `tsc` et le `tsconfig.json` du dépôt, contre
`next` 14.2.35, `react` 18.3.1, `@clerk/nextjs` 6.39.9, `@sentry/nextjs` 10.49.0, puis recompilé
par le vérificateur au commit `2364ef9` [L11]. « Compilé » veut dire « typé correctement », pas
« testé à l'exécution » : le comportement se vérifie avec `npm run build`. Tous sont écrits pour passer sans modification en Next 15 et 16
(cf. [next15-next16.md](next15-next16.md)). Les chemins `@/…` existent dans le dépôt, sauf
`ClientOnlyWidgets` (fichier à créer).

## 1. Page ISR à segment dynamique (rendue à la première visite)

```tsx
// Exemple minimal — fichier réel de référence : src/app/(client)/recettes/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import prisma from "@/lib/prisma";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

const getRecipe = cache(async (slug: string) =>
  prisma.recipe.findUnique({
    where: { slug },
    select: { title: true, description: true, published: true },
  })
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe || !recipe.published) notFound();
  return {
    title: recipe.title,
    description: recipe.description,
    alternates: { canonical: `${SITE_URL}/recettes/${slug}` },
  };
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe || !recipe.published) notFound();
  return <h1>{recipe.title}</h1>;
}
```

- `generateStaticParams` est indispensable : sans elle, `revalidate` est ignoré.
- `cache()` : une seule requête pour `generateMetadata` et la page. `cache` n'existe que dans le
  React embarqué par Next ; dans le `react` 18.3.1 qu'utilise Vitest il vaut `undefined` [L15] :
  le garder dans le fichier de page, pas au niveau module d'un helper de `src/lib` testé unitairement.
- Pas de `try/catch` : une erreur Prisma doit faire échouer la régénération.
- Canonical absolu via `SITE_URL`, convention du dépôt (`CLAUDE.md` § SEO).
- Ce bloc illustre la mécanique de rendu. Les règles d'indexation de la vraie page (`noindex` des
  recettes générées non relues) restent celles du fichier existant et du skill `seo-anti-penalty`.
- Écart connu : le fichier réel n'emploie pas encore `cache()` (deux requêtes Prisma identiques par
  rendu) et son `generateMetadata` renvoie `{}` quand la recette manque. Ne pas le « corriger » au
  passage : tout changement de métadonnées de cette page passe par `seo-anti-penalty`.

## 2. Route Handler : `params` asynchrones + revalidation à la demande

```ts
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ visible: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = await params;
    const data = bodySchema.parse(await req.json());

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: { visible: data.visible },
      select: { id: true, slug: true, visible: true },
    });

    revalidatePath("/", "layout");

    return apiSuccess(shop);
  } catch (error) {
    return handleApiError(error, "admin/shops/visibility");
  }
}
```

Dans le vrai code, `revalidatePath` passe par le helper unique décrit dans
[isr-revalidation.md](isr-revalidation.md) ; la portée `"layout"` globale est réservée aux actions
rares.

## 3. API de requête : toujours `await`

```ts
import { cookies, headers } from "next/headers";

export async function readGuestToken(cookieName: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName)?.value;
}

export async function readCountry(): Promise<string | null> {
  const h = await headers();
  return h.get("x-vercel-ip-country");
}
```

Tout appelant de ces fonctions rend sa route dynamique : jamais depuis un layout ni une page publique.
Forme pour un **nouveau** helper. Les helpers synchrones existants (`getTestRole()`,
`isTestActivated()`, `getVercelGeo()`) ne se convertissent pas au passage : voir
[next15-next16.md](next15-next16.md), ligne 2 du tableau.

## 4. Composants « navigateur seulement » : `ssr: false` dans un fichier client

```tsx
// src/components/providers/ClientOnlyWidgets.tsx (à créer) — widgets du groupe (client)
"use client";

import dynamic from "next/dynamic";

const ChatWidget = dynamic(
  () => import("@/components/chat/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false }
);

export function ClientOnlyWidgets() {
  return <ChatWidget />;
}
```

Un fichier client **par emplacement**, pour ne jamais monter deux fois le même widget : celui-ci
pour `(client)/layout.tsx` ; la même forme pour les cinq widgets du layout racine
(`ServiceWorkerRegistration`, `InstallPrompt`, `OfflineBanner`, `TestRoleSwitcher`,
`AnalyticsConsent`) et pour les trois de `(client)/page.tsx` (`OrderTracker`, `ReorderSection`,
`OfferPopup`) — les 8 appels que Next 15 refusera.

## 5. Layout serveur + providers clients

```tsx
// src/app/(client)/layout.tsx — forme cible, SANS "use client"
import { BottomNav } from "@/components/layout/BottomNav";
import { SeoFooter } from "@/components/layout/SeoFooter";
import { CartProviderWrapper } from "@/components/providers/CartProviderWrapper";
import { ClientOnlyWidgets } from "@/components/providers/ClientOnlyWidgets";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProviderWrapper>
      <div className="pb-20 md:pb-0">{children}</div>
      <SeoFooter />
      <BottomNav />
      <ClientOnlyWidgets />
    </CartProviderWrapper>
  );
}
```

`SeoFooter` (et les 68 ko de `SEO_CITIES`) redevient un Server Component : il est passé en
`children` au provider client au lieu d'être importé par un module client. Contrôle : la taille du
fichier `.next/static/chunks/app/(client)/layout-*.js` avant et après (70 ko aujourd'hui), et la
table des routes inchangée. `BottomNav` reste un Client Component importé par un layout serveur :
c'est permis.

## 6. Valeur dépendante de l'horloge dans un Client Component

```tsx
"use client";

import { useEffect, useState } from "react";
import { getShopStatus, type OpeningHours } from "@/lib/shop-hours";

export function ClosingSoonHint({ openingHours }: { openingHours: OpeningHours | null }) {
  const [closingSoon, setClosingSoon] = useState(false);

  useEffect(() => {
    if (!openingHours) return;
    setClosingSoon(getShopStatus(openingHours).status === "CLOSING_SOON");
  }, [openingHours]);

  if (!closingSoon) return null;
  return <span className="text-xs text-amber-700 dark:text-amber-400">Ferme bientôt</span>;
}
```

Le serveur et le premier rendu client produisent tous deux `null` ; la valeur arrive après montage.

## 7. Page cliente : `useSearchParams` sous `Suspense`, appel API conditionné à la session

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { hasTestModeCookie } from "@/lib/test-mode-client";

function ReferralField() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "";
  return <input name="ref" defaultValue={ref} readOnly />;
}

export default function ClientPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!((isLoaded && isSignedIn) || hasTestModeCookie())) return;
    const controller = new AbortController();
    fetch("/api/favorites", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setCount(Array.isArray(json?.data) ? json.data.length : null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [isLoaded, isSignedIn]);

  return (
    <main>
      <Suspense fallback={null}>
        <ReferralField />
      </Suspense>
      <p>{count ?? "—"}</p>
    </main>
  );
}
```

- Seul `ReferralField` sort du HTML prérendu ; le reste de la page reste statique.
- Variante déjà en place quand le paramètre n'est lu qu'une fois : `window.location.search` dans un
  `useEffect`, sans `useSearchParams()` ni `Suspense` (`src/app/(client)/inscription-boucher/page.tsx`).
- Aucun appel réseau pour un visiteur anonyme ; `isLoaded`/`isSignedIn` dans les dépendances.
- Pour un rafraîchissement périodique, `useVisiblePolling` (`src/hooks/useVisiblePolling.ts`) et non
  `setInterval`.

## 8. Page cliente à segment dynamique : `useParams`

```tsx
"use client";

import { useParams } from "next/navigation";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  return <p>Commande {id}</p>;
}
```

Évite la prop `params`, qui devient une `Promise` en Next 15.

## 9. Données d'une page ISR : relancer en production

```ts
import prisma from "@/lib/prisma";

export async function loadVisibleShops() {
  try {
    return await prisma.shop.findMany({
      where: { visible: true },
      select: { id: true, slug: true, name: true },
      orderBy: { rating: "desc" },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return [];
  }
}
```

Forme en place dans `src/app/(client)/page.tsx`. Le repli ne sert qu'en développement ; la forme la
plus simple reste l'absence de `try/catch` (`src/app/sitemap.ts`).

## 10. `global-error.tsx`

```tsx
// src/app/global-error.tsx (absent aujourd'hui)
"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
```

Forme documentée par Sentry [S25] ; `global-error` remplace le layout racine, d'où ses propres
`<html>` et `<body>` [S7]. L'habillage aux couleurs Klik&Go relève du skill `design-klikgo`.
