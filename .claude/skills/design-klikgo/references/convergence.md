# Converger sans redesign

Objectif : un code cohérent sans que l'utilisateur voie autre chose que les bugs corrigés. Pas de « grande refonte » : des lots petits, vérifiables, dans un ordre qui rend chaque lot suivant plus sûr.

## 1. Principes

1. **Corriger le socle avant les feuilles.** Tant que `cn()` et les tokens sont faux, chaque migration vers eux propage un défaut.
2. **Un lot = une nature de changement.** Ne jamais mêler un changement invisible (remplacement d'une paire par un token identique) et un changement visible (police, rayon, couleur).
3. **Le cliquet.** `design-audit.mjs --check` : les compteurs de dette ne remontent jamais. Uber mesure l'adoption de son design system écran par écran, la suit dans les builds quotidiens et constate que la dégradation vient de l'absence de garde-fous, pas d'une mauvaise intention ([S27]).
4. **La règle du campeur.** On ne migre pas un fichier « pour migrer », mais tout fichier ouvert pour une fonctionnalité est rendu dans un meilleur état : ses paires deviennent des tokens, ses boutons bruts des `Button`.
5. **Par surface.** Quatre surfaces indépendantes : client (`src/app/(client)`), cuisine (`boucher/commandes`), back-office boucher (`boucher/dashboard`, `boucher/produits`…), webmaster et admin. Finir une surface avant d'ouvrir la suivante ; l'ordre suit la valeur : client, cuisine, back-office, webmaster.
6. **Pas de redesign caché.** Si un remplacement modifie un pixel de façon perceptible, il sort du lot et passe par [points-a-arbitrer.md](points-a-arbitrer.md).

## 2. Ordre des lots

| Lot | Contenu | Visible ? | Vérification |
|---|---|---|---|
| **0a** | `cn()` : `extendTailwindMerge` + test ([composants.md](composants.md) §2) | oui, c'est le but : 23 boutons retrouvent leur couleur de texte ; les `Badge` reviennent à 11 px et les boutons par défaut à 15 px | `npm run test`, `/panier`, `/commandes`, `/inscription-pro`, `/profil` en clair, écrans à pastilles |
| **0b** | Classes fantômes : définir `tap-scale` et `no-scrollbar` dans `@layer utilities` de `globals.css`, ou retirer les 14 usages | discret si on les définit : 5 éléments montés réagissent à l'appui (`validation/[id]`, `client-header`), 2 rangées défilantes perdent leur barre (`FilterChips`, `OfferProductSection`) ; les 7 autres usages sont dans du code mort | recherche des trois noms |
| **0c** | `--border` et `--input` sombres sans alpha ; retirer `border-border/50` en attendant | oui en sombre : la bordure blanche des `Card` disparaît | `Card` en sombre |
| **0d** | `content` de `tailwind.config.ts` : ajouter `"./src/lib/**/*.{ts,tsx}"` (B12) | oui dans le webmaster : quatre pastilles de statut retrouvent leur fond | `webmaster/commandes`, `webmaster/boutiques/[shopId]` ; recherche de `bg-indigo-500/10` dans le CSS produit |
| **1** | Polices : variables `next/font` sur `<html>` ([typographie.md](typographie.md) §1) | **oui, tout le site** | accord du fondateur (A1), écrans denses à 375 px |
| **2a** | Tokens sans arbitrage : `--primary` exact, `--primary-hover`, `--muted-foreground` ([tokens.md](tokens.md) §4) | faiblement | `contrast.mjs --tokens` |
| **2b** | Tokens après arbitrage : `--background` (A14), `--success` et `--warning` (A5) | oui, modérément | `contrast.mjs --tokens`, pages sans fond propre |
| **3** | Primitives `ui/` : `button` (tailles 44 px, survol qui fonce, `loading`), `input`, `dialog` et `sheet` (tokens, durées préfixées B13, retour du focus selon le skill `accessibility-wcag`), `badge` (variantes d'état réparées), `status-badge` (deux retouches de contraste, libellés lus dans `design-tokens.ts`, [tokens.md](tokens.md) §6) | faiblement | test de composant (dès que le point T4 de `testing-strategy` est levé), clair et sombre |
| **4** | Thème : script anti-flash et `ThemeProvider` ([dark-mode.md](dark-mode.md) §3) ; filet ciblé `prefers-reduced-motion` ([etats-et-mouvement.md](etats-et-mouvement.md) §3) | non, hors disparition du flash | rechargement en sombre ; mouvement réduit émulé |
| **5** | Migration par surface (§3 et §4 ci-dessous), fichier par fichier | non | cliquet, captures avant et après |
| **6** | Ménage : code mort, doublons d'animations dans `tailwind.config.ts`, `THEME` et `--burgundy`, cartes de statut locales | non | `npm run build`, recherche d'imports |

Les lots 0a, 0b, 0c, 0d tiennent chacun en un commit de quelques lignes. Rien d'autre ne commence avant eux. Aucun ne touche un fichier du chantier de tarification en cours.

**Chantier de tarification (non fusionné au 2026-11-14).** Il réécrit `(client)/panier/page.tsx`, `CartItem`, `CartSuggestions`, `ProductCard`, `ProductSheet`, `TrancheSheet`, `WeightSheet`, `KitchenOrderCard`, les deux `OrderTicket`, `boucher/commandes/page.tsx`, `commande/[id]`, `commandes`, `suivi/[id]` (25 fichiers `.tsx`). Tant qu'il n'est pas fusionné : pas de lot 5 sur ces fichiers (conflits certains), pas de `--write-baseline` depuis une autre branche que celle qui a réellement fait baisser la dette, et les compteurs de ce document se relisent sur l'arbre courant avant d'être cités.

Lot 0b, définition compilée avec notre config (à placer dans le bloc `@layer utilities` existant de `globals.css`, puis remplacer les 2 `scrollbar-hide` par `no-scrollbar`) :

```css
.tap-scale {
  @apply transition-transform duration-150 active:scale-[0.97];
}
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
```

Une classe placée dans une couche Tailwind accepte les variantes (`md:no-scrollbar`) et n'est émise que si elle est utilisée ([S5]).

Lot 0d, vérifié à la compilation (les huit classes manquantes de B12 apparaissent, la feuille grossit de moins de 1 Ko) :

```ts
// tailwind.config.ts
content: [
  "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/lib/**/*.{ts,tsx}",
],
```

C'est le correctif immédiat. La cible reste de sortir les classes de `src/lib` ([tokens.md](tokens.md) §6) ; d'ici là, toute classe ajoutée hors de `src/app` et `src/components` se vérifie dans le CSS produit.

## 3. Table de remplacement des couleurs (lot 5)

Colonne « Identique » : le rendu est-il le même au pixel, une fois le lot 2 appliqué (2a pour le rouge, 2b pour le fond) ?

| Écrit aujourd'hui | Occ. | Remplacer par | Identique |
|---|---|---|---|
| `bg-white dark:bg-[#141414]` | 405 | `bg-card` | oui (#ffffff / #141414) |
| `bg-[#f8f6f3] dark:bg-[#0a0a0a]` | 96 | `bg-background` | oui après lot 2b |
| `bg-[#DC2626]`, `bg-red-600` + `text-white` | 189 | `bg-primary text-primary-foreground` | oui après lot 2a |
| `hover:bg-[#b91c1c]` | 107 (122 occurrences de `[#b91c1c]` en tout) | `hover:bg-primary-hover` | oui après lot 2a |
| `border-[#ece8e3] dark:border-white/10` | 170 | `border-border` | quasi (#e9e6e2 contre #ece8e3 ; sombre #2b2b2b contre blanc 10 %) |
| `border-gray-200 dark:border-white/10` | 277 | `border-border` | quasi (filet gris froid vers gris chaud) |
| `border-gray-100 dark:border-white/10` | 115 | `border-border` | non : filet un peu plus marqué, à regarder |
| `bg-gray-100 dark:bg-white/5` | 95 | `bg-muted` | quasi (#f0edea contre #f3f4f6 ; #1f1f1f contre #202020) |
| `text-gray-900 dark:text-white` | 649 | `text-foreground` | quasi (#2b221d contre #111827 ; #fafafa contre blanc) |
| `text-gray-500 dark:text-gray-400` | 1 181 | `text-muted-foreground` | non : gris chaud, un peu plus foncé en clair, un peu plus sombre en sombre |
| `text-[#DC2626]` sans variante sombre | 237 | `text-primary dark:text-red-400` | oui en clair ; en sombre c'est une correction de contraste |
| `text-gray-700 dark:text-gray-300`, `text-gray-600 dark:text-gray-400` | 473 | laisser tel quel | pas de token intermédiaire ; ne pas en inventer |
| `focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30` | 95 | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | non : correction d'accessibilité voulue |
| `bg-emerald-600 text-white`, `bg-green-600 text-white` | 26 | `bg-emerald-700 text-white` | non : correction de contraste voulue |
| `bg-amber-500 text-white`, `bg-orange-500 text-white` | 6 | `bg-amber-500 text-amber-950` ou `bg-amber-700 text-white` | non : correction de contraste voulue |

Les lignes « quasi » et « non » se migrent une surface à la fois avec comparaison de captures ; les lignes « oui » peuvent partir en masse.

Ce qu'on ne convertit pas : le ticket d'impression (`OrderTicket.tsx`, feuille autonome en noir et blanc), `opengraph-image.tsx` et `icon.tsx` (rendu d'image), les e-mails (HTML à styles en ligne), les couleurs d'étiquettes saisies par les bouchers.

## 4. Méthode pour un fichier

```bash
# 1. Mesurer avant
node .claude/skills/design-klikgo/scripts/design-audit.mjs --dir="src/components/shop" --json > /tmp/avant.json

# 2. Remplacer les paires « identiques » du fichier (motif exact, pas d'expression large)
#    Exemple avec l'outil d'édition : "bg-white dark:bg-[#141414]" -> "bg-card"
#    Attention aux variantes d'ordre : "dark:bg-[#141414] bg-white", et aux classes séparées
#    par d'autres ("bg-white border … dark:bg-[#141414]") : les traiter à la main.

# 3. Vérifier
npx tsc --noEmit && npm run lint && npm run test
node .claude/skills/design-klikgo/scripts/design-audit.mjs --check
```

- Un remplacement de masse se fait sur un motif **littéral** et un dossier, jamais avec une expression régulière sur tout `src/` : les deux moitiés d'une paire sont souvent séparées par d'autres classes, et `prettier-plugin-tailwindcss` réordonne les classes à l'enregistrement.
- Remplacer un `<button>` brut par `<Button>` : reprendre `type`, `onClick`, `disabled`, `aria-label` ; choisir la variante par intention ; ne garder dans `className` que la mise en page. Si aucune variante ne convient, c'est une variante à ajouter une fois, pas un `className` à répéter.
- Remplacer un overlay maison par `Dialog` ou `Sheet` : vérifier le portail (un parent en `overflow-hidden` ou en sombre forcé, voir [dark-mode.md](dark-mode.md) §4), la fermeture par Échap, le retour du focus.
- Capture avant et après de chaque écran touché, à 375 px en clair et en sombre (skills `qa` ou `browse`). Une différence non prévue annule le remplacement.
- Quand un lot a réellement réduit la dette : `design-audit.mjs --write-baseline`, et le nouveau `design-baseline.json` part dans le même commit. Ne jamais relever la référence pour faire passer un ajout.

## 5. Ce qu'il ne faut pas faire

| Tentation | Pourquoi non |
|---|---|
| Un commit « migration design system » de 200 fichiers | Impossible à relire, impossible à annuler, mélange visible et invisible. |
| Changer `--radius` pour « corriger » `rounded-lg` | 472 éléments changent de forme d'un coup : c'est un arbitrage, pas un correctif. |
| Passer à Tailwind 4 pendant la convergence | Renomme `shadow-sm`, `rounded-sm`, `outline-none`, change bordure et anneau par défaut, exige Safari 16.4+, Chrome 111+, Firefox 128+ ; Tailwind conseille de rester en 3.4 si l'on doit servir des navigateurs plus anciens ([S8]). Projet séparé, après convergence. |
| Créer des classes CSS avec `@apply` pour « nettoyer » | La doc Tailwind réserve l'extraction aux composants du framework ; `@apply` partout revient à réécrire du CSS ([S6]). |
| Ajouter un token par nuance rencontrée | 78 valeurs hex ne font pas 78 tokens. Les nuances voisines se rabattent sur le token existant. |
| Installer un plugin ESLint Tailwind pour interdire les valeurs arbitraires | `eslint-plugin-tailwindcss` : 2 072 étoiles, sous notre barre de fiabilité. Le cliquet du script suffit. |
| Supprimer une primitive « morte » sans vérifier | Certaines sont la bonne cible de migration (`skeleton`, `empty-state`, `status-badge`, `sheet`) : les réparer et les brancher, pas les effacer. |

## 6. Suivi

Indicateurs à faire descendre, valeur de départ au 2026-11-13 (`scripts/design-baseline.json`) :

| Indicateur | Départ | Cible fin de surface client |
|---|---|---|
| Couleurs hex arbitraires | 2 545 | divisé par deux |
| `text-white` sur aplat trop clair | 56 | 0 |
| Anneaux de focus translucides | 95 | 0 |
| Overlays sans sémantique `dialog` | 21 | 0 côté client |
| `confirm()` / `alert()` | 8 | 0 |
| Classes inexistantes | 14 | 0 |
| `<button>` brut / `<Button>` | 575 / 108 | rapport inversé sur la surface client |
| Tokens sémantiques | 196 | supérieur au nombre de paires restantes |

Les cibles sont des ordres de grandeur proposés, à confirmer par le fondateur ; la seule règle ferme est le cliquet.
