# Mode sombre

`CLAUDE.md` : « Dark mode supporté sur tous les composants ». Voici comment il fonctionne réellement et comment l'écrire sans doubler chaque classe.

## 1. Mécanique actuelle

| Élément | Réalité |
|---|---|
| Stratégie Tailwind | `darkMode: ["class"]` dans `tailwind.config.ts`. En 3.4.19 la variante compile en `.dark\:x:is(.dark *)`. La doc v3 indique que `selector` a remplacé `class` en 3.4.1 ([S3]) ; `class` reste accepté. |
| Bascule | `src/components/providers/ThemeProvider.tsx` : état React `light` par défaut, lecture de `localStorage.theme` puis `classList.toggle("dark")` dans un `useEffect`. |
| Préférence système | ignorée (`prefers-color-scheme` n'est lu nulle part). |
| Bouton | `ui/ThemeToggle.tsx`, présent seulement sur l'accueil client et `client-header`. |
| Contrôles natifs | `.dark { color-scheme: dark }` dans `globals.css` : barres de défilement et champs natifs suivent ([S21]). |
| Écriture dans les composants | 6 518 variantes `dark:` posées à la main, contre 196 usages de tokens. |
| Mode cuisine | sombre **forcé** : `(boucher)/layout.tsx` pose `bg-[#0a0a0a]` et les composants cuisine écrivent des couleurs sombres en dur, sans `dark:`. |

Vérifié dans un moteur Chromium : avec `:is(.dark *)`, une variante `dark:` ne s'applique **pas** à l'élément qui porte lui-même la classe `dark`, seulement à ses descendants ; les variables CSS de `.dark`, elles, s'appliquent dès cet élément.

## 2. Écrire un composant compatible : par tokens, pas par paires

```tsx
// À écrire
<div className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
  <p className="text-muted-foreground">…</p>
</div>

// À ne plus écrire
<div className="rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 dark:border-white/10 dark:bg-[#141414] dark:text-white">
  <p className="text-gray-500 dark:text-gray-400">…</p>
</div>
```

Un token change de valeur sous `.dark` : le composant n'a plus rien à savoir du thème. La variante `dark:` reste utile dans trois cas seulement :

1. Couleur de palette sans token (états, voir [tokens.md](tokens.md) §6) : `bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300`.
2. Rouge de marque en texte : `text-primary dark:text-red-400` (le `#DC2626` tombe à 3,81:1 sur `#141414`).
3. Ajustement d'ombre ou d'image : `shadow-card dark:shadow-none`.

Table de correspondance des paires existantes vers les tokens : [convergence.md](convergence.md) §3.

Règles propres au sombre :

- Pas de texte `gray-500` ou plus foncé sur surface sombre (3,81:1 et moins). Secondaire : `text-muted-foreground` (#8c8c8c, 5,48:1 sur carte) ou `gray-400`.
- L'élévation se lit par la surface, pas par l'ombre : page `#0a0a0a`, carte `#141414`, surface discrète `#1f1f1f`.
- Aplat primaire inchangé (`bg-primary` + blanc, 4,83:1) ; il contraste à 3,81:1 avec la carte sombre, suffisant pour un composant.
- Jamais de token de couleur avec alpha (`--border` sombre actuel) : voir B2 et [tokens.md](tokens.md) §4.
- Graphiques Recharts : utiliser `--tooltip-bg`, `--tooltip-border`, `--tooltip-text`, `--grid-stroke` de `globals.css`, pas `stroke="#e5e7eb"` en dur.

## 3. Supprimer le flash clair (B7)

La doc Tailwind v3 demande d'appliquer la classe par un script en ligne dans le `<head>` pour éviter le flash ([S3]). Avant de l'ajouter, vérifier que la CSP de `next.config.mjs` autorise ce script en ligne (état actuel et évolution de la CSP : skill `security-multitenant`). Le skill `security-multitenant` écarte une CSP à nonce (elle imposerait le rendu dynamique, contraire à la règle de coût CPU de `CLAUDE.md`) ; si cela changeait, le script devrait porter le nonce. Le script ne lit ni en-tête ni cookie : il ne change rien au prérendu des pages.

```tsx
// src/components/providers/ThemeProvider.tsx — compilé en strict
"use client";

import * as React from "react";

type Theme = "light" | "dark";
const ThemeContext = React.createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: "light", toggleTheme: () => {} });
export const useTheme = () => React.useContext(ThemeContext);

// Même clé localStorage qu'aujourd'hui ("theme") : aucun utilisateur ne perd son réglage.
export const themeInitScript = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("light");

  // Le DOM est déjà correct grâce au script : on ne fait que le lire.
  React.useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  // L'écriture se fait dans le gestionnaire d'événement, pas dans un effet :
  // aucun rendu intermédiaire ne peut retirer la classe.
  const toggleTheme = React.useCallback(() => {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Navigation privée : le réglage ne persiste pas.
    }
    setTheme(next);
  }, []);

  const value = React.useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

Dans `src/app/layout.tsx`, placer `<ThemeScript />` en premier enfant de `<head>` ; `suppressHydrationWarning` est déjà sur `<html>` (la classe `dark` ajoutée avant l'hydratation diffère du HTML serveur). L'icône de `ThemeToggle` dépend de `theme` : elle reste « lune » au premier rendu puis se corrige, sans erreur d'hydratation.

Suivre la préférence système (`prefers-color-scheme`) est une décision produit, pas un correctif : [points-a-arbitrer.md](points-a-arbitrer.md). `next-themes` (6 353 étoiles, recommandé par shadcn pour Next.js, [S1]) ferait le même travail mais c'est une dépendance de plus pour trente lignes.

## 4. Sombre forcé : le mode cuisine

Le mode cuisine doit rester sombre quel que soit le réglage du boucher (lisibilité en boutique, `CLAUDE.md`). Plutôt que des couleurs en dur, poser la classe `dark` sur l'enveloppe : tous les tokens et toutes les variantes `dark:` des descendants s'y appliquent.

```tsx
// src/app/(boucher)/layout.tsx, branche isKitchenMode (aujourd'hui : "min-h-screen bg-[#0a0a0a]")
<div className="dark min-h-screen bg-[#0a0a0a] text-foreground">{children}</div>
```

- Garder `bg-[#0a0a0a]`, le fond déjà en place : `bg-background` vaut noir pur sous `.dark` tant que le point A14 n'est pas tranché. Après alignement du token, écrire `bg-background`.
- `text-foreground` fonctionne sur l'enveloppe elle-même (variable CSS redéfinie par `.dark`) ; une variante `dark:` écrite sur cette même `div` ne s'appliquerait pas (§1).
- Changement à livrer seul et à regarder : les descendants qui portent déjà des variantes `dark:` (primitives `ui/`, modales) basculent en sombre dans la cuisine, ce qui est le but, mais chaque écran cuisine est à contrôler.
- Les modales Radix sont rendues dans un portail sous `<body>`, donc **hors** de l'enveloppe : passer `className="dark"` à leur contenu ou monter le portail dans l'enveloppe (`<DialogPrimitive.Portal container={ref.current}>`).
- Dette cuisine à corriger en même temps : `text-gray-500` et `text-gray-600` sur fond sombre (4,10:1 et 2,62:1 sur `#0a0a0a`) dans `KitchenOrderCard.tsx`.
- Il n'existe pas de classe pour forcer le clair dans une page sombre. Le ticket imprimé (`OrderTicket.tsx`) a sa propre feuille de style dans une iframe : ne pas le brancher sur les tokens.

## 5. Vérifier

- Chaque écran modifié est regardé en clair **et** en sombre à 375 px. Bascule rapide : `document.documentElement.classList.toggle("dark")` dans la console, ou `localStorage.theme = "dark"` puis rechargement.
- `node .claude/skills/design-klikgo/scripts/contrast.mjs --tokens` après toute modification de `globals.css`.
- Une paire précise : `node …/contrast.mjs "#f87171" "#141414"` ; fond translucide : `node …/contrast.mjs "#DC2626" "#DC26261a" --under="#141414"`.
- `design-audit.mjs` : la ligne « fichiers avec bg-white et aucune variante dark: » (9 aujourd'hui) ne doit pas monter.
