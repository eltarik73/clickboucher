# Composants : conventions d'API avec shadcn/ui, Radix et cva

Tous les extraits ci-dessous ont été compilés en mode `strict` avec les paquets installés (TypeScript du projet, React 18.3.1, cva 0.7.1, tailwind-merge 2.6.1, `@radix-ui/react-dialog` 1.1.15, sonner 1.7.4) et les classes compilées avec Tailwind 3.4.19.

## 1. Le modèle : du code qu'on possède, pas une bibliothèque

shadcn/ui se présente ainsi : ce n'est pas une bibliothèque de composants mais la manière de construire la sienne, et le code livré se modifie directement ([S31]). Chez nous cela veut dire :

- Une primitive vit dans `src/components/ui/`, un composant métier dans son dossier de domaine (`product/`, `cart/`, `boucher/`…).
- Corriger un bouton, c'est modifier `button.tsx`, pas ajouter `className="bg-[#DC2626] …"` à chaque appel (57 des 108 `<Button>` le font aujourd'hui).
- Les composants de la doc shadcn actuelle visent Tailwind v4 et React 19 : `@theme`, couleurs `oklch`, `data-slot`, plus de `forwardRef`, import depuis `radix-ui` ou `cn`, `shadow-xs`, `outline-hidden`, `tw-animate-css` ([S2], [S31]). **Ne jamais coller un composant de la doc tel quel.** L'adapter : `React.forwardRef`, `@radix-ui/react-*`, `cn` de `@/lib/utils`, tokens HSL, classes Tailwind 3.
- Le dépôt n'a pas de `components.json` : ne pas lancer `npx shadcn init` ni `add` (ils réécriraient `globals.css` et la config). Écrire la primitive à la main sur le modèle des fichiers existants.
- Ajouter une primitive Radix (Tabs, Select, Popover…) est un ajout de dépendance : paquet officiel `@radix-ui/react-<nom>` uniquement, un par besoin, signalé dans la PR. La doc Radix recommande désormais le paquet unifié `radix-ui` ([S11]) ; ne pas mélanger les deux styles d'import dans le dépôt sans décision.

## 2. `cn()` : le correctif à faire avant tout le reste

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge ne connaît que le thème Tailwind par défaut [S9] : chaque nom ajouté dans
// tailwind.config.ts (fontSize, boxShadow…) doit être déclaré ici, sinon il est fusionné à tort.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "title", "subtitle", "body-lg", "body", "caption", "micro"] }],
      shadow: [{ shadow: ["soft", "card", "elevated", "glow"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Test de non-régression à ajouter dans `src/lib/__tests__/utils.test.ts` (le fichier teste déjà `cn`) :

```ts
it("garde la taille et la couleur de texte du thème projet", () => {
  expect(cn("text-body", "text-primary-foreground")).toBe("text-body text-primary-foreground");
  expect(cn("text-body", "text-caption")).toBe("text-caption");
  expect(cn("shadow-sm", "shadow-glow")).toBe("shadow-glow");
});
```

Effets visibles, à annoncer dans la PR :

- les 23 boutons listés en B1 retrouvent leur texte blanc ;
- les boutons par défaut passent de la taille héritée à 15 px (`text-body`), le `font-semibold` de la base reste appliqué (les classes de graisse sont émises après celles de taille) ;
- les `<Badge>` (27 usages) retrouvent `text-micro` : ceux qui ne reçoivent pas de taille en `className` passent de la taille de leur parent à 11 px, donc des pastilles plus petites qu'aujourd'hui ;
- `CardTitle` retrouve `text-subtitle` là où une couleur de texte lui est passée.

Contrôler `/panier`, `/commandes`, `/inscription-pro`, `/profil`, `boucher/produits` et les écrans à pastilles (`boucher/clients`, `boucher/dashboard`, `webmaster/demandes`, `/pro`). Une classe de taille de l'échelle projet efface désormais, comme toute taille Tailwind, un `leading-*` écrit avant elle : écrire l'interligne après la taille.

## 3. Anatomie d'une primitive

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base : mise en page, typographie, focus, désactivé. Jamais de couleur ici.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-body font-semibold ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-11 px-4 text-caption",
        lg: "h-14 rounded-2xl px-8 text-body-lg",
        icon: "size-11 rounded-full",
      },
      fullWidth: { true: "w-full", false: null },
    },
    compoundVariants: [{ variant: ["outline", "ghost"], size: "icon", className: "text-foreground" }],
    defaultVariants: { variant: "default", size: "default", fullWidth: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, fullWidth }), className);
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
```

Ce qui est une règle dans cet exemple :

| Règle | Raison |
|---|---|
| `React.forwardRef` + `displayName` | React 18 ne passe pas `ref` en prop ; Radix a besoin de la ref pour `asChild` ([S11]). |
| `...props` répandu sur l'élément DOM, `className` fusionné **en dernier** par `cn()` | L'appelant peut ajuster une marge ; Radix injecte ses attributs et gestionnaires par les props ([S11]). |
| Variantes dans `cva`, type par `VariantProps` | Une seule source pour les classes et les types ([S10]). |
| `variant` = intention (`default`, `outline`, `ghost`, `destructive`), `size` = encombrement | Une variante ne porte jamais un nom de couleur (`red`, `green`) ni de page. |
| Variante booléenne `{ true: …, false: null }` et `compoundVariants` avec tableau | Syntaxe documentée de cva ([S10]). |
| `defaultVariants` toujours renseigné | Le composant nu doit être correct. |
| `asChild` pour rendre un `<Link>` | `<Button asChild><Link href="/">…</Link></Button>` : pas de `<a>` dans un `<button>`. Si l'on change le type d'élément, on reste responsable de son accessibilité ([S11]). |
| `"use client"` absent | Une primitive sans hook ni API navigateur reste un composant serveur ; ne l'ajouter que si nécessaire (`CLAUDE.md`). |
| Pas de variante responsive dans cva | cva l'exclut par conception ; écrire les classes `md:` à l'appel ou créer une variante dédiée ([S10]). |
| Survol qui fonce, jamais qui éclaircit | `hover:bg-primary/90` donne 4,33:1 en clair ; le remplacer par `hover:bg-primary-hover` dès que le token existe ([tokens.md](tokens.md) §4). |

Ce qu'un `className` d'appel a le droit de faire : marges, largeur, placement dans la grille. Ce qu'il n'a pas le droit de faire : couleur, rayon, hauteur, typographie. Si le besoin revient trois fois, c'est une variante.

Les `size` actuels `sm` (`h-10`) et `icon` (`h-10 w-10`) font 40 px : sous le seuil de 44 px de `CLAUDE.md`. Les passer à `h-11` / `size-11` avec la correction de `cn()`.

## 4. Bouton d'icône : le nom accessible exigé par le type

```tsx
type IconButtonProps = Omit<ButtonProps, "children" | "size" | "aria-label"> & {
  "aria-label": string;
  icon: React.ReactNode;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({ icon, ...props }, ref) => (
  <Button ref={ref} size="icon" {...props}>
    {icon}
  </Button>
));
IconButton.displayName = "IconButton";
```

Le nom se met sur le bouton, pas sur l'icône ([S25]). Avec `lucide-react` 0.378.0, ajouter `aria-hidden="true"` sur l'icône décorative : cette version ne le pose pas d'elle-même, contrairement à ce que décrit la doc actuelle.

## 5. Champ de formulaire : l'erreur reliée au champ

```tsx
type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(({ label, error, hint, id, className, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "flex h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground md:text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
          className
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
Field.displayName = "Field";
```

`aria-invalid` n'a pas de variante intégrée en Tailwind 3 : écrire `aria-[invalid=true]:` ([S7]). Les messages viennent de la validation Zod serveur (règle `CLAUDE.md`), jamais d'une règle dupliquée côté client seulement.

## 6. Overlays : toujours sur Radix Dialog

Radix fournit ce que 21 overlays maison n'ont pas : focus piégé dans la modale, Échap, annonce du titre ([S11]), c'est-à-dire l'essentiel du patron « dialog modal » du W3C ([S12]). Il manque un point : le retour du focus à la fermeture. Radix ne le rend qu'à un `Dialog.Trigger` (lu dans `@radix-ui/react-dialog` 1.1.15 : `onCloseAutoFocus` annule le comportement par défaut puis focalise `triggerRef`), et toutes nos modales sont pilotées par un état `open` sans trigger. Le correctif s'écrit une fois, dans `ui/dialog.tsx` et `ui/sheet.tsx` : patron « Dialogue modal et retour du focus » du skill `accessibility-wcag` (`references/patterns-composants.md` §3). Une feuille neuve se construit donc sur `ui/sheet` réparé ; l'extrait ci-dessous montre la structure et les classes, pas ce correctif.

```tsx
"use client"; // comme ui/dialog.tsx et ui/sheet.tsx : composant piloté par un état (open, onOpenChange)

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/button"; // l'IconButton du §4, à ajouter à button.tsx

export function BottomSheet({ open, onOpenChange, title, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        >
          <DialogPrimitive.Title className="font-display text-lg font-bold">{title}</DialogPrimitive.Title>
          {children}
          <DialogPrimitive.Close asChild>
            <IconButton variant="ghost" aria-label="Fermer" className="absolute right-3 top-3" icon={<X className="size-5" aria-hidden="true" />} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

- `DialogPrimitive.Title` est obligatoire ; pour le masquer, `className="sr-only"` (le paquet `react-visually-hidden` n'est pas installé). Sans description, passer `aria-describedby={undefined}` ([S11]).
- L'état s'expose par `data-state="open|closed"` : c'est lui qu'on stylise et qu'on anime, et Radix attend la fin de l'animation CSS avant de démonter ([S11]). Les classes `animate-in`, `fade-in-0`, `slide-in-from-bottom` viennent de `tailwindcss-animate`.
- Durée : `animate-in` et `animate-out` posent eux-mêmes 150 ms. Pour la changer, préfixer la durée comme l'animation (`data-[state=open]:duration-300`, `data-[state=closed]:duration-200`). Un `duration-300` nu ne change que les transitions : c'est le défaut actuel de `dialog.tsx` et `sheet.tsx` (B13), à corriger avec leur remise aux tokens.
- Convention du dépôt : le fichier qui enveloppe Radix Dialog porte `"use client"`, comme `dialog.tsx` et `sheet.tsx` (il reçoit des fonctions en props, il est donc toujours rendu côté client).
- `sheet.tsx` et `dialog.tsx` existants ont des couleurs en dur (`bg-white`, `text-[#2a2018]`, `border-[#e8e4df]`) et un bouton de fermeture de 32 px : les passer aux tokens et à 44 px avant de les réutiliser. `sheet.tsx` n'a aucune variante sombre.
- Pas de `vaul` pour les feuilles glissantes : dernier commit en 2025-10, hors de notre barre de fraîcheur.
- Confirmation destructive : `ConfirmDialog`, jamais `confirm()` ni `alert()` (8 appels à remplacer).

## 7. Retour d'action : sonner, et seulement sonner

```tsx
import { toast } from "sonner";

toast.promise(onDelete(), {
  loading: "Suppression…",
  success: "Supprimé",
  error: "Suppression impossible. Réessayez.",
});
```

`toast.success`, `toast.error`, `toast.promise` : API de sonner 1.7.4 ([S30]). `ui/Toast.tsx` est mort ; `NotificationToast` reste réservé aux notifications de commande poussées par le serveur. Une erreur de formulaire ne s'affiche pas en toast mais sous le champ (§5).

## 8. Quel composant pour quel besoin

| Besoin | Composant canonique | Ne pas recréer |
|---|---|---|
| Action | `ui/button` (`Button`, `asChild` pour un lien) | `<button className="bg-[#DC2626]…">` |
| Saisie | `ui/input` ; `Field` (§5) dès qu'il y a libellé et erreur | `<input>` stylé à la main |
| Surface | `ui/card` | `div` avec `bg-white dark:bg-[#141414] rounded-2xl border…` |
| Étiquette | `ui/badge` ; statut de commande ou de boutique : `ui/status-badge` | carte de couleurs locale |
| Modale, feuille, tiroir | `ui/dialog`, `ui/sheet` (après remise aux tokens) | `fixed inset-0` maison |
| Confirmation | `ui/ConfirmDialog` | `confirm()` |
| Toast | `sonner` | `ui/Toast`, bannière maison |
| Chargement de page | `ui/skeleton` dans `loading.tsx`, à la forme de la vraie page (`CLAUDE.md`) | `div` `animate-pulse` recopiés |
| Chargement d'action | `Button loading` | spinner posé à côté |
| Liste vide | `ui/empty-state` (icône, titre, phrase, action) | paragraphe gris isolé |
| Quantité | `ui/stepper` (après correction des tailles : boutons de 28 à 44 px aujourd'hui) | un quatrième sélecteur (`QuantitySelector`, `QuantityPicker`, pas-à-pas de `ProductCard`) |
| Interrupteur | `ui/switch` | case à cocher déguisée |
| Image | `ui/SafeImage` ; `<img>` natif dans `OfferPopup` (`CLAUDE.md`) | `next/image` sans repli |
| Icône | `lucide-react`, `size-4` (16 px) dans un bouton, `size-5` en navigation, trait par défaut | SVG inline (25 aujourd'hui), autre jeu d'icônes |
| Logo | `ui/KlikLogo` | `layout/KlikGoLogo` (doublon) |

Avant de créer un composant : `grep -rn "<NomProbable" src/components`. Avant d'en supprimer un « mort » : vérifier l'absence d'import dynamique (`grep -rn "nom-du-fichier" src`).

## 9. Fichiers et tests

- Nommage : `CLAUDE.md` impose le PascalCase pour les composants ; les primitives de type shadcn sont en minuscules (`button.tsx`, `dialog.tsx`). Garder la casse existante du fichier qu'on modifie ; nouveau composant métier en PascalCase, nouvelle primitive `ui/` en minuscules.
- Moins de 300 lignes par fichier (`CLAUDE.md`) : `KitchenOrderCard.tsx` (757) et `ProductCard.tsx` (408) sont à découper quand on les touche, en extrayant les sous-blocs en composants, pas avec `@apply` ([S6]).
- Un test de composant vit dans `tests/components/<Composant>.test.tsx` (Vitest + Testing Library). Au 2026-11-14 ces tests sont exclus de la suite tant que le blocage JSX de `vitest.config.ts` n'est pas levé (point T4 du skill `testing-strategy`, qui fait foi sur l'emplacement et la configuration). Le test de `cn()`, lui, est un `.ts` de `src/lib/__tests__/` et tourne déjà. Tester le comportement : rôle, nom accessible, `disabled` pendant `loading`, `aria-invalid` en erreur ; pas la liste de classes.
- Tri des classes : `prettier-plugin-tailwindcss` est en place. Pour qu'il trie aussi l'intérieur de `cva()` et `cn()`, ajouter `"tailwindFunctions": ["cva", "cn"]` à `.prettierrc.json` (option documentée dans le README du plugin installé).
