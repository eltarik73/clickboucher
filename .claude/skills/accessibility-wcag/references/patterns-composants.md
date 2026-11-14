# Patrons de composants accessibles — Klik&Go

Chaque extrait a été compilé avec `tsc --noEmit` (mode strict, `tsconfig.json` du dépôt) contre les versions installées : React 18.3.1, Next 14.2.35, `@radix-ui/react-dialog` 1.1.15, `sonner` 1.7.4, `lucide-react` 0.378.0, Tailwind 3.4.19, `tailwind-merge` 2.6.1 `[V4]`, puis recompilé aux deux relectures `[V8][V9]`. Le comportement de focus des §3 et §4 a été exécuté contre le Radix installé, dans jsdom `[V7][V9]`. Aucun patron n'a encore été essayé dans un navigateur ni avec un lecteur d'écran : c'est l'objet de la « Définition de terminé ». Les identifiants entre crochets renvoient à `sources.md`.

Principe directeur de l'APG : un élément HTML natif vaut mieux qu'un rôle ARIA, et poser un rôle engage à fournir tout son comportement clavier `[A1]`.

## Sommaire

1. [Choisir la primitive](#1-choisir-la-primitive)
2. [`cn()` : réparer la fusion des classes](#2-cn--réparer-la-fusion-des-classes)
3. [Dialogue modal et retour du focus](#3-dialogue-modal-et-retour-du-focus)
4. [Confirmation destructive](#4-confirmation-destructive)
5. [Alerte « nouvelle commande » en cuisine](#5-alerte--nouvelle-commande--en-cuisine)
6. [Onglets](#6-onglets)
7. [Interrupteur](#7-interrupteur)
8. [Toasts et messages d'état](#8-toasts-et-messages-détat)
9. [Champs, erreurs, groupes](#9-champs-erreurs-groupes)
10. [Quantité et boutons icône](#10-quantité-et-boutons-icône)
11. [Carte cliquable contenant un bouton](#11-carte-cliquable-contenant-un-bouton)
12. [Mouvement, son, compte à rebours](#12-mouvement-son-compte-à-rebours)
13. [Focus visible, cibles, thème cuisine, repères](#13-focus-visible-cibles-thème-cuisine-repères)

## 1. Choisir la primitive

| Besoin | Utiliser | Ne pas faire |
|---|---|---|
| Fenêtre qui bloque la page | `@/components/ui/dialog` | `div fixed inset-0` avec `role="dialog"` à la main |
| Panneau bas ou latéral | `@/components/ui/sheet`. Aucun appelant aujourd'hui et aucune variante sombre : le premier usage le répare d'abord (lot 3 de `design-klikgo`) | Piège de focus maison (`CartDrawer.tsx`) ; recopier `WeightSheet.tsx` |
| Confirmer une action irréversible | `ConfirmDialog` avec `variant="danger"`, une fois le patron §4 appliqué | Dialogue dont le focus arrive sur « Supprimer » ; second composant de confirmation |
| Alerte qui exige une réponse | Patron §5 (`role="alertdialog"`) | Calque plein écran `role="button"` |
| Vues exclusives d'un même écran | Patron §6 (onglets) | Boutons colorés sans `aria-selected` |
| Réglage oui/non immédiat | `@/components/ui/switch` avec étiquette | `button` coloré sans rôle ni nom |
| Filtre ou option activable | `<button aria-pressed>` (§9). `ui/toggle-pill.tsx` le fait déjà mais n'a aucun appelant | État porté par la teinte seule, sans attribut |
| Retour après action | `toast` de `sonner` | `useNotify`, `useToast` (sans région live) |
| État permanent d'un écran | `LiveRegion` §8 ou `role="alert"` | Texte qui change en silence |
| Navigation | `<Link>` | `div onClick` + `router.push` |
| Action | `<button type="button">` | `div role="button" tabIndex={0}` |

## 2. `cn()` : réparer la fusion des classes

Défaut constaté : `twMerge` range nos tailles de police maison parmi les couleurs de texte, donc `text-body-lg` efface `text-primary-foreground`. Un `Button` en taille `sm`, `lg` ou `xl` perd la couleur de texte de sa variante : texte presque noir sur le bouton rouge, 3,67:1 en thème clair `[V1][V3]`. Reproduit avec le `twMerge` installé `[V8]` :

| Appel | Résultat de `cn()` aujourd'hui |
|---|---|
| `text-body … text-primary-foreground` (taille par défaut) | `text-primary-foreground` : la taille `text-body` disparaît |
| `text-body … text-primary-foreground … text-caption` (taille `sm`) | `text-caption` : la couleur disparaît |

**Le correctif est écrit une seule fois, dans `design-klikgo`** (`references/composants.md` §2) : `extendTailwindMerge` avec les groupes `font-size` et `shadow`, et son test dans `src/lib/__tests__/utils.test.ts`. Ne pas en écrire une variante ici. La forme `extend.classGroups["font-size"]` a été exécutée avec `tailwind-merge` 2.6.1 : `cn("text-primary-foreground", "text-body-lg")` conserve les deux classes `[V8]`.

À savoir avant de le livrer :

- Portée : 108 `<Button>`, dont 46 en taille `sm`, `lg` ou `xl` ; 22 n'ont aucune couleur de remplacement dans leur `className` (inventaire B1 de `design-klikgo`, recoupé à deux unités près `[V8]`). Exemple en production : « Découvrir les boucheries » du panier vide.
- Effet de bord visible : les boutons de taille par défaut retrouvent `text-body` (15 px au lieu de la taille héritée). Relire `/panier`, `/commandes`, `/inscription-pro`, `/profil` en clair et en sombre.
- Contrôle d'accessibilité après correctif : la règle `color-contrast` disparaît de `/panier` en thème clair ; la retirer de `KNOWN`.

## 3. Dialogue modal et retour du focus

Ce que Radix fournit déjà à nos enveloppes `dialog.tsx` et `sheet.tsx` : piège du focus, Échap, arrière-plan masqué aux lecteurs d'écran, défilement verrouillé `[T6][V1]`. Ce que nous devons fournir :

- **Un titre.** `DialogTitle` est obligatoire ; sans lui Radix écrit une erreur en console. Pour le masquer : `className="sr-only"`.
- **Une description ou son absence déclarée.** `DialogDescription`, ou `aria-describedby={undefined}` sur `DialogContent` si le contenu est structuré `[T6][A2]`.
- **Le focus initial.** Par défaut, le premier élément focalisable dans l'ordre du DOM. Le bouton fermer de nos enveloppes est rendu après `children`, donc le premier contrôle du contenu reçoit le focus : placer l'action la moins risquée en premier `[A2]`.
- **Le retour du focus.** Le dialogue modal de Radix annule le retour de focus par défaut puis focalise son `Dialog.Trigger` ; sans trigger, le focus tombe sur `<body>` `[V1][V7]`. Aucun de nos dialogues n'a de trigger. Choisir ainsi :

| Situation | Moyen |
|---|---|
| Un seul bouton d'ouverture, rendu dans le même composant que le dialogue | `<DialogTrigger asChild>` autour du bouton, à l'intérieur de `<Dialog>` (l'état `open` contrôlé reste possible). Radix rend le focus au trigger `[T6]`, même quand le clic n'a pas focalisé le bouton `[V9]` |
| Dialogue ouvert par un état, depuis une liste, un hook ou un autre composant (`ConfirmDialog`, modales du mode cuisine) | Enveloppe ci-dessous, écrite une fois dans `dialog.tsx` et `sheet.tsx` |
| Le bouton d'ouverture disparaît pendant le dialogue (panier vidé, commande retirée de la colonne) | L'appelant passe `onCloseAutoFocus` et focalise l'élément logique suivant `[A2]` (second extrait) |

```tsx
// src/components/ui/dialog.tsx — même logique dans sheet.tsx
const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const openerRef = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn("…classes actuelles…", className)}
        onOpenAutoFocus={(event) => {
          const active = document.activeElement;
          // <body> n'est pas un ouvreur : Safari ne focalise pas un bouton cliqué.
          openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          const opener = openerRef.current;
          if (!event.defaultPrevented && opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X aria-hidden="true" size={16} />
          <span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
```

Ce que l'exécution a montré (Radix 1.1.15 dans jsdom, ouverture puis Échap) `[V7][V9]` :

| Cas | Focus après fermeture |
|---|---|
| Code actuel : ouverture par état, sans trigger | `<body>` |
| Enveloppe, bouton d'ouverture focalisé (clavier) | le bouton d'ouverture |
| `DialogTrigger`, bouton non focalisé au clic (cas Safari), avec ou sans enveloppe | le trigger |
| Enveloppe sans trigger, bouton non focalisé au clic (cas Safari) | `<body>` |
| Ouvreur retiré du DOM, sans repli | `<body>` |
| Ouvreur retiré du DOM, repli passé par l'appelant | l'élément choisi |

Deux conséquences :

- Le test `active !== document.body` est nécessaire. Sans lui, l'enveloppe « rend » le focus à `<body>` et empêche Radix de focaliser un trigger présent.
- Safari ne donne pas le focus à un bouton cliqué `[T16]`. Pour un clic ou un toucher dans Safari, l'enveloppe seule n'a donc rien à rendre : préférer `DialogTrigger` chaque fois que la première ligne du tableau s'applique. Au clavier, le bouton est toujours focalisé. Le comportement avec VoiceOver sur iOS n'a pas été vérifié : c'est un point du contrôle manuel.

Repli quand l'ouvreur disparaît : le gestionnaire de l'appelant s'exécute avant celui de l'enveloppe, qui s'efface dès que `preventDefault()` a été appelé.

```tsx
<DialogContent
  onCloseAutoFocus={(event) => {
    if (cartIsEmpty) {
      event.preventDefault();
      pageTitleRef.current?.focus();
    }
  }}
>
  …
</DialogContent>

<h1 ref={pageTitleRef} tabIndex={-1}>Mon panier</h1>
```

Migration des modales écrites à la main (liste dans l'audit, §3 P0) : remplacer le calque par `Dialog` + `DialogContent`, garder le contenu. Ne jamais écrire `aria-modal="true"` soi-même : l'attribut ment tant que l'arrière-plan reste atteignable `[A2]`.

## 4. Confirmation destructive

Pour vider le panier, changer de boutique, refuser ou annuler une commande, signaler une rupture. Un seul composant : `src/components/ui/ConfirmDialog.tsx`, que l'on fait évoluer. Ses deux appelants (`panier/page.tsx`, `lib/hooks/use-cart.tsx`) passent déjà `variant="danger"`, sans effet aujourd'hui : les deux branches de style sont identiques.

Ce qui change : rôle `alertdialog` pour la variante `danger`, focus sur « Annuler », pas de fermeture par clic extérieur, repli de focus transmis `[A2][A3]`. Notre `DialogContent` transmet ses props à Radix, qui les applique après son `role="dialog"` : le rôle se surcharge `[V1][V7]`.

```tsx
"use client";

import { useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
  onConfirm,
  onCancel,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const danger = variant === "danger";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(danger ? { role: "alertdialog" as const } : {})}
        className="mx-4 max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onPointerDownOutside={(event) => {
          if (danger) event.preventDefault();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="px-5 pt-3">{description}</DialogDescription>
        <div className="flex gap-3 px-5 pb-5 pt-4">
          <Button ref={cancelRef} variant="outline" className="flex-1" onClick={() => { onCancel?.(); onOpenChange(false); }}>
            {cancelLabel}
          </Button>
          <Button className="flex-1 bg-[#DC2626] text-white hover:bg-[#b91c1c]" onClick={() => { onConfirm(); onOpenChange(false); }}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

À respecter :

- Le rôle passe par une propagation conditionnelle. Écrire `role={danger ? "alertdialog" : undefined}` efface le rôle `dialog` dans la variante par défaut `[V7]`.
- Avec le correctif du §3, l'enveloppe capture l'ouvreur avant d'appeler ce `onOpenAutoFocus` : l'ordre est déjà le bon, ne pas l'inverser.
- Libellé du bouton de confirmation : le verbe de l'action (« Vider le panier », « Refuser la commande »), jamais « OK ». La valeur par défaut « Confirmer » ne sert qu'aux confirmations sans risque.
- Quand la confirmation retire le bouton d'ouverture (panier vidé), l'appelant passe `onCloseAutoFocus` (§3, second extrait).

Variante écartée : la primitive `@radix-ui/react-alert-dialog` existe `[T7]` mais n'est pas installée. L'ajouter est une dépendance de plus pour le même résultat.

## 5. Alerte « nouvelle commande » en cuisine

`OrderAlertOverlay.tsx` actuel : calque `role="button"` contenant un bouton, trois animations infinies, focus laissé derrière. Cible : un `alertdialog` qui prend le focus, dont le seul bouton arrête le son. Les props ne changent pas (`order`, `onDismiss`) : l'appelant, `commandes/page.tsx`, arrête déjà la sonnerie dans `onDismiss`.

```tsx
"use client";

import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { KitchenOrder } from "@/hooks/use-order-polling";

type Props = {
  order: KitchenOrder | null;
  onDismiss: () => void;
};

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

export default function OrderAlertOverlay({ order, onDismiss }: Props) {
  return (
    <Dialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent
        role="alertdialog"
        className="dark border-2 border-emerald-500/50 bg-[#141414] p-8"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <Bell aria-hidden="true" size={32} className="mx-auto animate-ring text-emerald-400" />
        <DialogTitle className="mt-4 text-center text-xl text-white">Nouvelle commande</DialogTitle>
        <DialogDescription className="mt-2 text-center text-base text-gray-300">
          {order
            ? `Commande #${order.orderNumber}, ${order.items.length} article${order.items.length > 1 ? "s" : ""}, ${formatPrice(order.totalCents)}`
            : ""}
        </DialogDescription>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 min-h-[56px] w-full rounded-xl bg-emerald-700 text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Voir la commande
        </button>
      </DialogContent>
    </Dialog>
  );
}
```

Points de décision :

- Échap, la croix et le bouton passent tous par `onDismiss` (arrêt du son, alerte retirée). Un seul chemin de sortie évite une alerte fermée dont le son continue.
- `bg-emerald-700` : blanc à 5,48:1 (`emerald-600` : 3,77:1).
- Le son est un doublon de l'alerte visuelle, jamais le seul canal ; l'alerte visuelle ne doit pas dépendre du son non plus.
- `animate-ring` est déclarée hors `@layer utilities` dans `globals.css` : `motion-safe:animate-ring` ne génère rien `[V9]`. C'est le filet ciblé du §12 qui l'arrête sous mouvement réduit. Les deux autres animations infinies de l'ancien calque (`animate-pulse-slow`, `animate-bounce-gentle`) ne sont pas reprises.
- La classe `dark` est posée sur le contenu parce que le dialogue est rendu dans un portail, hors du conteneur du mode cuisine (§13). Elle n'agit que sur les descendants : le fond du contenu lui-même est donc écrit en dur.
- Si une deuxième commande arrive pendant que l'alerte est ouverte, mettre à jour le texte du dialogue ouvert plutôt que d'en empiler un second.
- À essayer sur la tablette : une commande qui arrive pendant qu'une autre modale est ouverte (ajustement de prix, rupture, scanner). Deux dialogues Radix s'empilent ; le cas n'a pas été exécuté.

## 6. Onglets

Pour les onglets mobiles du mode cuisine (`commandes/page.tsx:766-800`). Activation automatique : les quatre listes sont déjà en mémoire, donc le panneau s'affiche sans délai `[A5]`.

```tsx
"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

type TabDef<K extends string> = { key: K; label: string; count: number };

type Props<K extends string> = {
  tabs: TabDef<K>[];
  active: K;
  onChange: (key: K) => void;
  label: string;
  children: ReactNode;
};

export function KitchenTabs<K extends string>({ tabs, active, onChange, label, children }: Props<K>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    let next = -1;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  };

  return (
    <>
      <div role="tablist" aria-label={label} className="flex gap-1">
        {tabs.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(el) => { refs.current[index] = el; }}
              type="button"
              role="tab"
              id={`kitchen-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls="kitchen-tabpanel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="min-h-[44px] flex-1 rounded-lg px-2 text-xs font-semibold text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white aria-selected:bg-[#DC2626] aria-selected:text-white"
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1">
                  {tab.count}
                  <span className="sr-only"> commandes</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="kitchen-tabpanel" aria-labelledby={`kitchen-tab-${active}`} tabIndex={0}>
        {children}
      </div>
    </>
  );
}
```

Le style se pilote par `aria-selected:` `[T9]` : l'état visuel et l'état annoncé ne peuvent plus diverger. Un seul panneau réétiqueté suffit ici, car un seul contenu est monté à la fois.

La barre de navigation du bas n'est pas un jeu d'onglets : ce sont des liens dans un `<nav aria-label="…">`, avec `aria-current="page"` sur le lien actif.

## 7. Interrupteur

`ui/switch.tsx` a le bon rôle. Il lui manque une étiquette à l'usage, un anneau de focus visible et un état « off » lisible `[A6][W11]`.

```tsx
"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";

export function LabelledSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
```

Dans `switch.tsx` : remplacer `focus-visible:ring-[#DC2626]/30` (1,62:1) par `focus-visible:ring-ring`, et `bg-stone-200` par une teinte à 3:1 au moins sur le fond (par exemple `bg-gray-500`, 4,83:1 sur blanc).

Règle APG : l'étiquette ne change pas avec l'état. « Boutique en ligne » + `aria-checked`, jamais « En ligne » puis « Hors ligne » `[A6]`. L'interrupteur du mode cuisine (`commandes/page.tsx:587`) doit devenir un `Switch` étiqueté ; le texte « En ligne / Hors ligne » à côté reste comme complément visuel.

## 8. Toasts et messages d'état

**Un seul système de toast : `sonner`** `[T12]`. Son conteneur est une région `aria-live="polite"` déjà présente dans le DOM `[V1]`, ce qui satisfait 4.1.3 pour les confirmations `[W5]`. `NotificationToast.tsx` n'annonce rien : migrer ses 4 fichiers appelants (`boucher/produits/ProductForm.tsx`, `ProductFormPage.tsx`, `produits/page.tsx`, `boucher/images/page.tsx`) vers `toast` de `sonner`, puis retirer `NotificationProvider` de `layout.tsx`. `Toast.tsx` n'a aucun appelant : le supprimer.

```tsx
// src/app/layout.tsx
<Toaster position="top-center" richColors containerAriaLabel="Notifications" duration={6000} />
```

La durée par défaut de `sonner` est de 4 000 ms `[V1]`. Les 6 000 ms proposés sont un choix maison pour laisser le temps de lire, à valider avec `ux-marketplace`.

Règles d'usage :

| Situation | Canal |
|---|---|
| Confirmation d'une action (« Ajouté au panier », « Code appliqué ») | `toast.success` |
| Erreur de champ | Texte sous le champ, relié au champ (§9). Jamais un toast seul |
| Erreur qui bloque le parcours (commande refusée, paiement échoué) | Texte persistant dans la page avec `role="alert"`. Un toast peut doubler, pas remplacer |
| État durable (session expirée, boutique en pause, hors connexion) | Bandeau persistant, `role="alert"` s'il est urgent, `role="status"` sinon |
| Information que l'utilisateur doit pouvoir relire | Jamais uniquement dans un toast : il disparaît `[W6][A4]` |

Limites vérifiées de `sonner` 1.7.4 `[V1]` : tous les toasts sont « polis », y compris `toast.error` ; le libellé du bouton fermer est figé en anglais (`"Close toast"`), donc ne pas activer `closeButton` sans avoir revérifié après une montée de version.

Message d'état hors toast (total du panier, nombre de créneaux, fin de chargement) :

```tsx
"use client";

import { useEffect, useState } from "react";

export function LiveRegion({ message }: { message: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(message);
  }, [message]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}
```

La région est rendue vide au montage puis remplie : c'est la condition d'une annonce fiable `[T10]`. La monter une fois par écran, pas dans chaque ligne. Exemple panier : `<LiveRegion message={`${itemCount} articles, total ${fmtPrice(finalTotal)}`} />`, ce qui reprend l'exemple « panier » de WCAG `[W5]`. Deux messages identiques de suite ne sont pas réannoncés : inclure la donnée qui change.

`role="alert"` et `aria-live="assertive"` interrompent la lecture en cours : les réserver à ce qui ne peut pas attendre `[T10]`. Une alerte ne déplace jamais le focus `[A4]`.

## 9. Champs, erreurs, groupes

Règles :

- Étiquette visible, reliée par `htmlFor`/`id` (mieux supporté que l'étiquette englobante) `[W16]`. Le texte indicatif n'est pas une étiquette ; s'il existe, il doit tenir 4,5:1 `[W10]`.
- `autoComplete` exact sur toute donnée personnelle : `email`, `given-name`, `family-name`, `tel` `[W1]` (1.3.5). `type` et `inputMode` adaptés.
- Erreur : texte sous le champ, relié par `aria-describedby`, `aria-invalid` sur le champ, couleur `text-red-700 dark:text-red-400` (6,47:1 et 6,66:1). Le message dit quoi corriger et donne un exemple `[W15]`.
- À la soumission : focus sur le premier champ en erreur, et un résumé annoncé `[W15]`.
- Ne jamais vider un champ valide après une erreur ; ne pas redemander une information déjà donnée dans le même parcours `[W12]`.
- Ne jamais bloquer le collage dans un champ d'authentification ou de code `[W13]`.

```tsx
"use client";

import { forwardRef, useId } from "react";
import { Input, type InputProps } from "@/components/ui/input";

type FieldProps = Omit<InputProps, "id"> & { label: string; error?: string; hint?: string };

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, required, ...inputProps },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-900 dark:text-white">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <Input ref={ref} id={id} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint && <p id={hintId} className="mt-1 text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
      {error && <p id={errorId} className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
});
```

Soumission avec focus et résumé (à appliquer au formulaire invité de `panier/page.tsx`) :

```tsx
function onSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const next: Errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Saisissez un email valide, par exemple nom@exemple.fr";
  if (!firstName.trim()) next.firstName = "Saisissez votre prénom";
  setErrors(next);
  if (next.email) emailRef.current?.focus();
  else if (next.firstName) firstNameRef.current?.focus();
  else onValid({ email: email.trim(), firstName: firstName.trim() });
}

const count = Object.keys(errors).length;

<form noValidate onSubmit={onSubmit}>
  <p role="alert" className={count > 0 ? "text-sm font-medium text-red-700 dark:text-red-400" : "sr-only"}>
    {count > 0 ? `${count} champ${count > 1 ? "s" : ""} à corriger` : ""}
  </p>
  <Field ref={emailRef} label="Email" type="email" inputMode="email" autoComplete="email" required
    value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} />
  …
</form>
```

Le paragraphe `role="alert"` reste dans le DOM en permanence, vide quand tout va bien. La validation serveur Zod reste obligatoire (CLAUDE.md) ; ses messages reviennent par le même canal.

Groupes de boutons radio (mode de retrait, paiement) : un `fieldset` et sa `legend`. Les radios natifs donnent déjà la navigation aux flèches `[A7]`.

```tsx
<fieldset>
  <legend className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Créneau de retrait</legend>
  <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-gray-400 p-3 dark:border-gray-500">
    <input type="radio" name="pickup-mode" checked={value === "asap"} onChange={() => onChange("asap")} className="h-5 w-5 accent-[#DC2626]" />
    <span className="text-sm font-medium">Dès que possible</span>
  </label>
  …
</fieldset>
```

Créneau horaire : un bouton à bascule, dont la sélection ne repose pas sur la couleur seule.

```tsx
<button type="button" aria-pressed={selected} disabled={!available} onClick={onSelect}
  className="min-h-[44px] rounded-xl border border-gray-400 px-2 py-2.5 text-sm font-medium aria-pressed:border-[#DC2626] aria-pressed:bg-[#DC2626] aria-pressed:text-white disabled:opacity-50 dark:border-gray-500">
  {start}
  {available && <span className="block text-xs">{remaining} place{remaining > 1 ? "s" : ""}</span>}
</button>
```

Un `StarRating` interactif gagne à devenir cinq `input type="radio"` masqués visuellement dans un `fieldset` : le clavier est alors correct sans code.

Bordure de champ : `#ece8e3` sur blanc fait 1,22:1, et le jeton `--input` 1,24:1. Quand la bordure est le seul indice de l'emplacement du champ (champ blanc sur carte blanche, cas du panier), c'est un échec de 1.4.11 `[W11]`. `border-gray-500 dark:border-gray-400` (4,83:1 et 7,26:1) règle le cas en attendant l'arbitrage sur le jeton.

## 10. Quantité et boutons icône

Un bouton icône a un nom (`aria-label`), une icône masquée (`aria-hidden="true"`, car `lucide-react` 0.378 ne la masque pas `[V1]`), une cible de 44 px. `title` seul ne nomme pas de façon fiable `[W16]`, et son infobulle demande un pointeur : elle n'existe ni au clavier ni au toucher `[T15]`.

```tsx
import { Minus, Plus, Trash2 } from "lucide-react";

type Props = { name: string; quantity: number; onChange: (qty: number) => void; onRemove: () => void };

export function QuantityControls({ name, quantity, onChange, onRemove }: Props) {
  return (
    <div role="group" aria-label={`Quantité pour ${name}`} className="flex items-center gap-2">
      <button type="button" aria-label={`Diminuer la quantité de ${name}`} onClick={() => onChange(quantity - 1)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-gray-500">
        <Minus aria-hidden="true" size={16} />
      </button>
      <span className="min-w-[2ch] text-center text-sm font-bold">
        <span className="sr-only">Quantité : </span>
        {quantity}
      </span>
      <button type="button" aria-label={`Augmenter la quantité de ${name}`} onClick={() => onChange(quantity + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#DC2626] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Plus aria-hidden="true" size={16} />
      </button>
      <button type="button" aria-label={`Supprimer ${name} du panier`} onClick={onRemove}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:text-[#b91c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-gray-400">
        <Trash2 aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
```

Le nom du produit dans chaque libellé distingue dix boutons « Augmenter » identiques dans la liste des contrôles d'un lecteur d'écran. Le nouveau total est annoncé par la `LiveRegion` du §8. Quand la quantité tombe à zéro et que la ligne disparaît, déplacer le focus sur la ligne suivante ou sur le titre du panier.

Ne jamais masquer un contrôle hors survol (`sm:opacity-0 sm:group-hover:opacity-100`) : il devient invisible au focus clavier. Si l'effet est voulu, ajouter `focus-visible:opacity-100`.

Lien icône (retour) : `<Link href={backHref} aria-label="Retour à la boutique">` + icône `aria-hidden`.

Un bouton dont l'état change (son coupé, favori) : soit `aria-pressed` avec un libellé fixe, soit un libellé qui change, jamais les deux.

## 11. Carte cliquable contenant un bouton

`ProductCard.tsx:173` pose `role="button"` sur la carte, qui contient le bouton d'ajout : 40 violations `nested-interactive` sur une page boutique `[V3]`. Patron : la carte n'est pas interactive ; le nom du produit est le bouton, étiré sur toute la carte par un pseudo-élément ; le bouton d'ajout est un frère placé au-dessus.

```tsx
<article className="relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#141414]">
  <div className="relative aspect-[4/3]">
    <Image src={imageUrl} alt={name} fill sizes="(max-width: 768px) 50vw, 240px" className="object-cover object-center" />
  </div>
  <div className="p-3">
    <h3 className="text-sm font-semibold">
      <button type="button" onClick={onOpen}
        className="text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[#DC2626]">
        {name}
      </button>
    </h3>
    <p className="mt-1 text-sm font-bold">{priceLabel}</p>
  </div>
  <button type="button" aria-label={`Ajouter ${name} au panier`} onClick={onAdd}
    className="absolute bottom-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#DC2626] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <Plus aria-hidden="true" size={18} />
  </button>
</article>
```

Même correction pour `NotificationBell.tsx:109` (un `div role="button"` dans un `Link`) : garder le `Link` seul et appeler `markAsRead` dans son `onClick`.

Le texte alternatif des images produit reste descriptif et sobre : c'est aussi la règle des skills SEO (pas de mots-clés empilés).

## 12. Mouvement, son, compte à rebours

**État.** Aucune règle `prefers-reduced-motion` dans `src/styles/globals.css` ; un seul test JavaScript (`OrderCountdown.tsx`). Les classes du mode cuisine (`animate-ring`, `animate-pulse-slow`, `animate-bounce-gentle`, `flash-green`, `flash-red`) y sont déclarées hors `@layer utilities` : `motion-safe:animate-ring` ne génère aucune règle `[V9]`.

**Ce qui est exigé.** Au niveau AA, WCAG n'impose pas de suivre `prefers-reduced-motion` (le critère sur les animations déclenchées par une interaction, 2.3.3, est de niveau AAA). Les obligations de niveau A sont 2.2.2 (une boucle de plus de 5 s à côté d'un contenu s'arrête ou se masque) et 2.3.1 (flashs), traitées plus bas. Suivre le réglage système est la bonne pratique décrite par web.dev : retirer le mouvement non essentiel, garder ce qui informe `[T11]`.

**Règles.**

1. Code neuf : `motion-safe:` devant toute animation Tailwind native décorative (`motion-safe:animate-pulse`, `motion-safe:animate-fade-up` : les deux compilent `[V9]`) `[T9]`.
2. Classes maison hors `@layer` : un filet ciblé dans `globals.css`, qui les coupe sous `prefers-reduced-motion: reduce`. Le bloc CSS est écrit une seule fois, dans `design-klikgo` (`references/etats-et-mouvement.md` §3) : ne pas en écrire un second ici. Il utilise `animation: none`, que web.dev déconseille quand du code attend `animationend` `[T11]` ; aucun fichier de `src/` n'écoute cet événement `[V9]`.
3. Pas de règle globale sur `*` (durées ramenées à 0,01 ms) tant que le point à arbitrer n° 9 n'est pas tranché. web.dev la présente comme une astuce de feuille de style d'utilisateur, « à vos risques », qui n'arrête pas les animations de l'API Web Animations et peut casser un site `[T11]`. Chez nous elle figerait aussi les indicateurs `animate-spin`.
4. Dette restante : 239 `animate-pulse`, `ping`, `bounce` ou `spin` sans préfixe (audit §1). Les préfixer au fil des chantiers, sauf les indicateurs de chargement, qui informent : un `animate-spin` garde son mouvement et s'accompagne d'un texte « Chargement… ».
5. En JavaScript : `window.matchMedia("(prefers-reduced-motion: reduce)")`, avec écoute de `change` `[T11]`.

Vérifier à la main, mouvement réduit activé : le compte à rebours de commande, l'apparition des toasts, l'alerte de nouvelle commande.

Autres règles :

- Rien ne clignote plus de trois fois par seconde `[W8]`. `flash-green` et `flash-red` (`globals.css:238-243`) font trois cycles en 1,5 s : conforme, à ne pas accélérer.
- Une animation qui dure plus de 5 s à côté d'un autre contenu doit pouvoir être arrêtée ou masquée `[W7]`. En cuisine, `animate-pulse` infini sur une carte en retard ou sur le bouton « En pause » : remplacer par un état fixe (bordure, icône, libellé « En retard »).
- Un indicateur de chargement seul à l'écran n'est pas concerné `[W7]`.
- Son : tout son lancé automatiquement et qui dure plus de 3 s a un mécanisme d'arrêt `[W9]`. La fiche du critère ne traite pas les sons courts répétés ; notre sonnerie de commande reprend toutes les 5 s sans fin (`src/lib/sounds.ts:279`) et nous la traitons comme un son continu. Le bouton son (`commandes/page.tsx:657` à `161f920`) est ce mécanisme : il lui faut un nom, `aria-pressed` et 44 px.
- `document.title` qui alterne chaque seconde (`use-kitchen-notifications.ts:39`) : préférer un titre stable avec compteur, « (2) Mode Cuisine | Klik&Go ».

**Compte à rebours avant envoi** (`OrderCountdown.tsx`) : voir « Points à arbitrer » de `SKILL.md`. Quelle que soit la décision :

- annoncer une fois (« Envoi dans 5 secondes. Annuler ? ») au lieu d'une région live qui parle chaque seconde ;
- garder le focus sur « Annuler » (c'est le cas) ;
- proposer « Envoyer maintenant » ;
- l'état final (« Commande envoyée », ou l'erreur) est porté par un élément `role="status"` ou `role="alert"`.

## 13. Focus visible, cibles, thème cuisine, repères

**Focus.** Jamais `outline-none` sans remplacement dans la même liste de classes. Standard maison, déjà celui de `Button` et `Input` : `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Sur fond sombre fixe : `focus-visible:ring-white`. Un anneau stylé par nous doit tenir 3:1 `[W11]` : pas d'opacité réduite (`ring-[#DC2626]/30` fait 1,62:1).

**Focus masqué.** Le bouton collant du panier (`sticky bottom-0`), la barre de navigation basse, le `CartFAB` et le bandeau de consentement recouvrent le bas de l'écran. Un élément focalisé ne doit jamais être entièrement caché dessous `[W4]` : réserver la place (`pb-…` sur le conteneur) et poser `scroll-padding-bottom` sur `html` à la hauteur de la barre.

**Cibles.** Règle maison (CLAUDE.md) : 44 px. Plancher WCAG 2.2 AA : 24 px, ou un espacement tel qu'un cercle de 24 px centré sur la cible ne touche aucune autre cible `[W3]`. Écrire `min-h-11 min-w-11` (ou `h-11 w-11`) sur tout contrôle tactile. Pour agrandir la zone sans agrandir le dessin : padding, ou pseudo-élément `after:absolute after:-inset-2`.

**Thème du mode cuisine.** L'écran est toujours sombre, mais `dark:` ne s'active que si l'utilisateur a choisi le thème sombre. Poser la classe `dark` sur le conteneur :

```tsx
// src/app/(boucher)/layout.tsx — branche isKitchenMode
<div className="dark min-h-screen bg-[#0a0a0a] text-white">{children}</div>
```

Avec `darkMode: ["class"]`, Tailwind 3.4.19 génère `:is(.dark *)` : les variantes `dark:` s'appliquent à tous les descendants, pas à l'élément qui porte la classe `[V9]`. D'où `text-white` écrit en dur sur le conteneur. Les modales Radix sont rendues dans un portail hors de ce conteneur : leur ajouter `dark` aussi (comme dans le §5). Texte secondaire en cuisine : `text-gray-400` au minimum (7,44:1 sur `#111`), jamais `gray-500` à `gray-700`.

**Repères et titres.** `src/app/layout.tsx:183` rend déjà `<main id="main-content">`. Une page ou un layout enfant n'écrit donc pas `<main>` : utiliser `<div>` ou `<section aria-labelledby="…">`. Un seul `h1` par page, puis une hiérarchie sans saut ; un intitulé de bloc (« Créneau de retrait ») est un titre ou une `legend`, pas un `span`. Deux `<nav>` sur une page portent chacun un `aria-label` distinct.

**Titre de page.** L'annonceur de route de Next lit `document.title`, puis le `h1` `[T8]` : chaque page exporte un `title` unique via `metadata` (gabarit `%s | Klik&Go`). Toute modification de `title` ou de `h1` sur une page indexable passe aussi par les skills SEO.

**Zoom.** Ne jamais ajouter `maximumScale` ni `userScalable: false` au `viewport` de `layout.tsx`. Le contenu reste utilisable à 320 px de large sans défilement horizontal `[W1]` (1.4.10).
