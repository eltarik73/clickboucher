# Patterns de code vérifiés

Tous les extraits ci-dessous ont été **recompilés le 14/11/2026** avec le `tsc` du projet, en mode strict, contre l'arbre de travail (chantier « intégrité des commandes » compris) : TypeScript 5.9.3, React 18.3.1, Next 14.2.35, sonner 1.7.4, lucide-react 0.378.0, Tailwind 3.4.19, `@radix-ui/react-dialog` 1.1.15. Les fonctions pures des §3 et §4 ont aussi été exécutées. Aucun extrait n'a été essayé dans un navigateur : tester à l'écran avant de livrer. Ils ne sont pas dans le dépôt ; les créer au bon endroit (`src/components/…` ou `src/lib/…`) avec leur test quand la fonction est pure.

Dépendances absentes du projet, donc à ne pas supposer : `react-hook-form`, `vaul`, `framer-motion`, `zustand`, `@radix-ui/react-radio-group`, `@radix-ui/react-tabs`.

Partage avec `accessibility-wcag` : le balisage accessible (composant `Field`, région d'état `LiveRegion`, retour du focus des dialogues) est défini dans `accessibility-wcag/references/patterns-composants.md`. Ce fichier ne le recopie pas : il donne le comportement attendu et les composants propres au parcours.

## 1. Champ : erreur à la sortie, retirée dès correction

Balisage : composant `Field` d'`accessibility-wcag` (§9 — libellé visible, `aria-invalid`, `aria-describedby`, résumé d'erreurs annoncé à la soumission). Comportement à lui ajouter pour le formulaire invité de `panier/page.tsx` [B4] :

```ts
"use client";

import { useCallback, useState } from "react";

type Validator = (value: string) => string | undefined;

/** Erreur montrée à la sortie du champ, jamais avant ; retirée dès que la valeur redevient valide. */
export function useFieldError(validate: Validator) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const onBlur = useCallback(
    (value: string) => {
      setTouched(true);
      setError(validate(value));
    },
    [validate],
  );
  const onChange = useCallback(
    (value: string) => {
      if (touched) setError(validate(value));
    },
    [touched, validate],
  );
  return { error, onBlur, onChange };
}

export const validateEmail: Validator = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? undefined
    : "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.";
```

Attributs par champ : e-mail `type="email" inputMode="email" autoComplete="email" enterKeyHint="next"` ; prénom `autoComplete="given-name"` ; nom `family-name` ; téléphone `type="tel" inputMode="tel" autoComplete="tel"`, marqué « (facultatif) » dans son libellé, avec la raison de la demande en aide [B5]. `type`, `inputMode` et `autoComplete` sont déjà en place dans `panier/page.tsx` ; ce qui manque, ce sont les libellés visibles, les erreurs reliées et la validation à la sortie du champ (aujourd'hui tout est validé à l'appui sur le bouton final).

## 2. Sélecteur de créneau

Un seul composant pour l'invité et le connecté. Le balisage suit le patron d'`accessibility-wcag` (§9 : bouton à bascule `aria-pressed`, sélection qui ne repose pas sur la couleur seule) ; s'y ajoutent les règles de ce skill : 48 px de haut, créneau complet désactivé **et** étiqueté, places restantes visibles.

```tsx
"use client";

export type PickupSlot = { start: string; end: string; available: boolean; remaining: number };

export function PickupSlotPicker({
  slots,
  value,
  onChange,
}: {
  slots: PickupSlot[];
  value: string | null;
  onChange: (slot: PickupSlot) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Heure de retrait</legend>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            aria-pressed={value === slot.start}
            disabled={!slot.available}
            onClick={() => onChange(slot)}
            className="flex min-h-[48px] flex-col items-center justify-center rounded-xl border border-gray-400 bg-white text-sm font-medium text-gray-900 transition-colors aria-pressed:border-[#DC2626] aria-pressed:bg-[#DC2626] aria-pressed:text-white disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-500 dark:bg-[#1a1a1a] dark:text-white dark:disabled:bg-white/5 dark:disabled:text-gray-400"
          >
            {slot.start.replace(":", "h")}
            <span className="text-xs font-normal">
              {slot.available ? `${slot.remaining} place${slot.remaining > 1 ? "s" : ""}` : "Complet"}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
```

Le type `PickupSlot` est celui renvoyé par `/api/shops/[id]/available-slots`. Les contrastes des états désactivé et sélectionné n'ont pas été mesurés : les passer au script de contraste d'`accessibility-wcag` avant de livrer.

## 3. Annonce d'un changement de statut sur le suivi

Le changement de statut s'annonce sans déplacer le focus (WCAG 4.1.3) ; le toast visuel reste en complément. Région d'état : composant `LiveRegion` d'`accessibility-wcag` (§8), monté une fois dans la page. Message à lui passer :

```ts
import { ORDER_STATUS_LABELS } from "@/lib/design-tokens";

/** Texte à passer à la région d'état du suivi quand le statut change. */
export function orderStatusAnnouncement(displayNumber: string, status: string): string {
  return `Commande ${displayNumber} : ${ORDER_STATUS_LABELS[status] ?? status}`;
}
```

## 4. Fenêtre horaire au lieu d'un compte à rebours

Fonction pure : la placer dans `src/lib/` avec un test dans `src/lib/__tests__/` (heure d'été, heure d'hiver, passage de minuit).

```ts
const PARIS = "Europe/Paris";

/** « 14h30 – 14h40 » : une fenêtre fixe plutôt qu'un compte à rebours. */
export function formatPickupWindow(estimatedReady: Date, windowMin = 10): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: PARIS });
  const end = new Date(estimatedReady.getTime() + windowMin * 60_000);
  const hm = (d: Date) => fmt.format(d).replace(":", "h");
  return `${hm(estimatedReady)} – ${hm(end)}`;
}
```

Sorties constatées (Node 22) : `formatPickupWindow(new Date("2026-11-13T13:30:00Z"))` → `14h30 – 14h40` ; `new Date("2026-06-15T21:55:00Z")` → `23h55 – 00h05` ; avec `windowMin = 5`, `2026-11-13T07:05:00Z` → `08h05 – 08h10`. La largeur de 10 minutes est un choix d'équipe à valider avec les bouchers (Deliveroo utilise 5 minutes pour une arrivée de livreur [P1]). Côté composant, calculer après le montage (`useEffect`) comme `EarliestPickupTime.tsx`, pour éviter un écart d'hydratation (règle CLAUDE.md : pas d'horloge dans le rendu initial).

## 5. Clé d'idempotence par tentative de commande — déjà en place, à réutiliser

Le chantier « intégrité des commandes » l'a écrite : `prepareCheckoutAttempt` (`src/lib/cart/order-payload.ts`) garde la même clé tant que le contenu confirmé ne change pas, et `panier/page.tsx` la conserve en `sessionStorage`. Ne pas écrire un second mécanisme (hook, `useRef`…). Forme de l'appel, pour tout nouvel écran qui confirmerait une commande :

```ts
import {
  parseCheckoutAttempt,
  prepareCheckoutAttempt,
  type CheckoutSelection,
} from "@/lib/cart/order-payload";

const CHECKOUT_ATTEMPT_KEY = "klikgo-checkout-attempt";

/** Corps de POST /api/orders : même clé tant que le contenu confirmé ne change pas. */
export function buildConfirmedRequest(selection: CheckoutSelection, amountDueCents: number) {
  const previous = parseCheckoutAttempt(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY));
  const { request, attempt } = prepareCheckoutAttempt(selection, amountDueCents, previous, () =>
    crypto.randomUUID(),
  );
  sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(attempt));
  return request;
}
```

`amountDueCents` est le « Total à payer » du devis (`useOrderQuote`). Effacer la clé stockée après un succès (`panier/page.tsx` le fait dans `onSuccess`). `crypto.randomUUID()` exige un contexte sécurisé (HTTPS ou localhost). Si `src/lib/cart/order-payload.ts` n'existe pas dans votre branche, le chantier n'y est pas : le signaler, ne pas improviser.

## 6. Retrait d'une ligne avec « Annuler »

```ts
import { toast } from "sonner";
import type { CartContextType, CartItem } from "@/lib/hooks/use-cart";

type ShopRef = { id: string; name: string; slug: string };

export function removeWithUndo(
  cart: Pick<CartContextType, "addItem" | "removeItem">,
  item: CartItem,
  shop: ShopRef,
) {
  cart.removeItem(item.id);
  toast(`${item.name} retiré du panier`, {
    duration: 8000,
    action: { label: "Annuler", onClick: () => cart.addItem(item, shop) },
  });
}
```

À savoir : si la ligne retirée était la dernière, le panier repasse à l'état vide (boutique oubliée) ; `addItem(item, shop)` la rétablit, d'où le paramètre `shop`. `addItem` additionne les quantités d'une ligne de même identifiant : l'annulation rétablit donc la quantité d'origine tant que le client n'a pas rajouté le même article entre-temps. La durée de 8 s est un choix d'équipe (plus longue que la durée par défaut des toasts, parce qu'elle porte une action).

## 7. Note de boutique : jamais sans avis

```tsx
import { Star } from "lucide-react";

export function ShopRating({ rating, ratingCount }: { rating: number; ratingCount: number }) {
  if (ratingCount <= 0) {
    return <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Nouveau sur Klik&amp;Go</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star size={12} aria-hidden="true" className="fill-yellow-500 text-yellow-500" />
      <span className="font-semibold text-gray-900 dark:text-white">{rating.toFixed(1).replace(".", ",")}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">({ratingCount} avis)</span>
      <span className="sr-only">{`Note ${rating.toFixed(1).replace(".", ",")} sur 5, ${ratingCount} avis`}</span>
    </span>
  );
}
```

Le seuil d'affichage (dès 1 avis, ou à partir de 5) et le libellé « Nouveau sur Klik&Go » sont à décider ; voir confiance-et-persuasion.md. `rating` et `ratingCount` doivent venir d'avis réels (`seo-anti-penalty`).

## 8. État vide avec action

```tsx
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function EmptyOrders() {
  return (
    <EmptyState
      icon={<ShoppingBag size={28} aria-hidden="true" />}
      title="Aucune commande pour l'instant"
      description="Vos commandes apparaîtront ici, avec leur suivi et un bouton pour recommander."
      action={
        <Button asChild className="bg-[#DC2626] hover:bg-[#b91c1c]">
          <Link href="/">Voir les boucheries</Link>
        </Button>
      }
    />
  );
}
```

`EmptyState` n'est importé nulle part aujourd'hui : vérifier son rendu (clair, sombre) au premier usage.

## 9. Feuille produit sur la brique Radix existante

Ne pas recopier le squelette de `WeightSheet.tsx`. Partir de `components/ui/sheet.tsx` (`Sheet`, `SheetContent`, `SheetTitle`, `SheetDescription`) : Radix Dialog fournit le rôle, le piège de focus et Échap. Le **retour du focus** n'est automatique que si l'ouverture passe par `SheetTrigger` ; nos feuilles sont pilotées par un état `open`, il faut donc le correctif d'`accessibility-wcag` (patron §3, « Dialogue modal et retour du focus »). Avant le premier usage, corriger la brique, qui n'a jamais été montée : styles sombres (`dark:bg-[#1a1a1a]`, bordure), bouton de fermeture de 44 px, hauteur maximale avec défilement interne (`max-h-[85dvh] overflow-y-auto`), police du titre posée en style en ligne. Ce travail n'a pas été fait ni vérifié ici : le traiter comme une tâche à part, avec `accessibility-wcag` et `design-klikgo`.
