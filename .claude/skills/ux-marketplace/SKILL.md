---
name: ux-marketplace
description: Patterns d'interface et heuristiques de conversion pour la place de marché Klik&Go (commande à retirer) — liste et carte boutique, menu, carte et feuille produit au poids, barre panier, panier, sélecteur de créneau, formulaire invité, suivi de commande, états vide/chargement/erreur, signaux de confiance, avis, notifications, écran cuisine. À charger avant de créer ou modifier un écran client ou boucher, un formulaire, un message d'erreur, un badge, ou tout élément censé améliorer la conversion ou la rétention.
when_to_use: Écran, composant, formulaire, bouton, toast, feuille (bottom sheet), squelette, état vide, message d'erreur, badge, preuve sociale, urgence, note et avis, cible tactile, microcopie, taux de conversion, abandon de panier, recommande, ShopCard, ProductCard, WeightSheet, panier, suivi.
---

# UX marketplace Klik&Go — patterns d'interface et heuristiques

Ce skill dit **comment un écran doit se comporter** pour qu'un client commande vite et revienne. Les règles « qui peut commander quoi, quand » sont dans `click-and-collect` ; les couleurs, polices et jetons dans `design-klikgo` ; les critères WCAG détaillés dans `accessibility-wcag` ; la vitesse dans `web-performance`. Les règles sur les avis du propriétaire (`seo-anti-penalty`) priment sur tout ce qui suit.

Chaque heuristique porte sa source entre crochets ([references/sources.md](references/sources.md)). Une règle sans crochet est un choix d'équipe, pas un fait établi.

**État du code décrit** : arbre de travail du 14/11/2026 (HEAD `32c581f` + chantier « intégrité des commandes », non committé et encore en mouvement — voir l'avertissement en tête de `click-and-collect`). Aucun numéro de ligne n'est donné ; les tailles et les textes cités ont été relus ce jour-là : relire le fichier avant de s'y fier.

## Les 12 heuristiques

1. **Réponse visible en moins de 100 ms à chaque geste.** Au-delà de 1 s, montrer que ça travaille ; au-delà de 10 s, une progression et un moyen d'annuler [N2]. Mise à jour optimiste, puis réconciliation avec le serveur (modèle : `components/ui/FavoriteButton.tsx`). Objectif de terrain : INP ≤ 200 ms au 75e centile [W7].
2. **Le pouce d'abord.** Action principale ≥ 44 × 44 px (règle CLAUDE.md, valeur par défaut d'Apple [W9]) ; viser 48 px et 8 px d'écart sur les écrans denses et en cuisine [W4] ; jamais sous 24 px, plancher WCAG 2.2 AA [W1].
3. **Un libellé visible par champ.** Le texte d'exemple disparaît à la saisie, gêne la relecture et la correction [N1][W5].
4. **Le coût complet tôt.** Frais, minimum de commande, caractère estimé du total : avant le dernier écran. Coûts annexes : 40 % des abandons déclarés ; total invisible d'avance : 12 % [B1].
5. **Invité d'abord, compte après.** Le chemin sans compte est le premier visible, nommé clairement ; le compte se propose une fois la commande passée, avec le seul mot de passe à saisir [B2][B3].
6. **Montrer la viande.** Photo réelle et options sur les produits phares : dans l'analyse DoorDash, le nombre de photos est le premier facteur lié à la conversion d'un menu, la personnalisation vient ensuite [P4].
7. **Progression lisible d'un coup d'œil, heure en fenêtre.** Barre en segments ; « 14h30 – 14h40 » plutôt qu'un minuteur : un compte à rebours qui remonte inquiète [P1]. Dernière information en premier, mots courants [N4].
8. **Tout état a un écran.** Chargement : squelette fidèle à la page, pour une attente de page < 10 s ; rien sous 1 s [N3]. Vide : dire que c'est vide, à quoi sert la zone, et donner l'action [N9]. Erreur : près du problème, en clair, avec la suite, sans perdre la saisie [N5].
9. **Une preuve n'est montrée que vraie et suffisante.** Moyenne toujours avec le nombre d'avis [B10] ; un petit nombre dessert [N11] ; rareté et compte à rebours uniquement sur données réelles [N8][L2].
10. **Recommander est un levier de rétention à portée de main.** Dernière commande dans le premier écran de l'accueil pour un client connecté, ajout direct [B6].
11. **Une feuille pour une tâche courte.** Bouton de fermeture visible, retour arrière et Échap pris en charge, jamais deux feuilles empilées, pas de parcours long dedans [N6][W3].
12. **Ce qui change sans action de l'utilisateur s'annonce.** Statut de commande, compteur panier, erreurs d'un formulaire : `role="status"` ou `role="alert"` [W2] ; balisage exact dans `accessibility-wcag` (patrons §8 et §9).

## Patterns par surface

| Surface | À faire | À éviter | Fichier |
|---|---|---|---|
| Liste des boutiques | Commandables d'abord ; délai, distance ou ville, note **avec** nombre d'avis ; boutique fermée grisée **avec** heure de réouverture | Demander le GPS au chargement ; « Fermé » sans suite ; « 0.0 (0) » | `NearbyShops.tsx`, `ShopCard.tsx` |
| Carte boutique | Toute la carte est un lien ; le cœur favori est un bouton distinct de 44 px ; image `SafeImage` qualité 60 | Informations uniquement au survol (invisibles au doigt) | `ShopCard.tsx` |
| Page boutique | En-tête : statut, délai, horaires, minimum de commande ; pastilles de catégorie collantes ; barre panier fixe dès 1 article | Bandeau de pause sans bloquer l'ajout ; pastilles de 36 px | `boutique/[slug]/page.tsx`, `ShopProductsClient.tsx` |
| Carte produit | Prix + unité, estimation « ≈ x € pour y g », « + » de 44 px qui devient compteur [B8] ; produit déjà au panier repérable [B9] | Nom tronqué sans accès au nom complet ; rupture cliquable ; prix calculé dans le composant | `ProductCard.tsx` |
| Feuille produit | Construite sur `ui/sheet.tsx` ou `ui/dialog.tsx` (Radix : rôle, focus piégé, Échap ; le retour du focus demande le correctif d'`accessibility-wcag`) ; préréglages + saisie libre + « ± » [N7] ; total mis à jour à chaque geste ; bouton « Ajouter · 12,40 € » | Modale maison sans rôle ; boutons de 32–36 px ; option obligatoire non signalée | `WeightSheet.tsx`, `TrancheSheet.tsx`, `ProductSheet.tsx` |
| Barre panier | Nombre d'articles, total estimé, verbe d'action ; respecte `env(safe-area-inset-bottom)` et la `BottomNav` | Masquer du contenu ; total présenté comme définitif | `ShopProductsClient.tsx` |
| Panier | « − n + » à mise à jour immédiate, 0 = retrait, « Annuler » après retrait [B11] ; lignes et total = devis serveur (`useOrderQuote`) ; bouton final collant | Bouton « Mettre à jour » ; info-bulle `title` (inaccessible au doigt) ; total recalculé dans la page | `panier/page.tsx` |
| Créneau | Grille de boutons dont la sélection est annoncée (`aria-pressed`, patron d'`accessibility-wcag`) ; jour en clair ; créneau complet désactivé et étiqueté « Complet » ; heure estimée pour « Dès que possible » | Grille de `<button>` sans état sélectionné annoncé (cas actuel) ; date sans borne | `panier/page.tsx` |
| Formulaire invité | Libellés visibles, `autoComplete`, `inputMode`, erreur à la sortie du champ, effacée dès correction [B4] ; téléphone facultatif avec sa raison [B5] | Texte d'exemple comme libellé ; bouton désactivé sans explication [W5] | `panier/page.tsx` |
| Suivi | Numéro géant + `Prénom.N` ; barre en segments ; fenêtre horaire ; actions selon l'état ; écran d'échec avec motif et sortie | Minuteur à la seconde ; consigne de retrait sur une commande refusée ; confettis sans `prefers-reduced-motion` (`commande/[id]`) | `SuiviClient.tsx`, `commande/[id]/page.tsx` |
| Historique | Carte : boutique, date, statut, total ; « Recommander » en un geste (`cartItemFromOrderLine`) | Reconstruire une ligne de panier à la main | `commandes/page.tsx` |
| Écran cuisine | Une action principale par carte, ≥ 48 px ; état du lien toujours visible | Texte de 10–12 px sur les actions ; geste irréversible sans rattrapage | `KitchenOrderCard.tsx` |

Détail écran par écran, avec les mesures relevées : [references/patterns-ecrans.md](references/patterns-ecrans.md).

## Briques existantes à réutiliser (ne pas en recréer)

« Jamais montée » = le fichier existe mais n'est importé nulle part au 14/11/2026 : la brique n'a jamais été vue à l'écran, la tester (clair, sombre, clavier, 375 px) avant de la généraliser.

| Besoin | Brique | Remarque |
|---|---|---|
| Bouton | `components/ui/button.tsx` — tailles `default` 48 px, `lg` 56 px, `xl` 64 px, `icon-lg` 48 px, `sm` 40 px, `icon` 40 px | `sm` et `icon` sont sous 44 px : ajouter `min-h-[44px] min-w-[44px]` pour une action tactile (correctif de fond prévu dans `design-klikgo`) |
| Dialogue | `ui/dialog.tsx` (Radix Dialog 1.1.15) | Radix ne rend le focus qu'à un `Dialog.Trigger`, que le code n'utilise pas : appliquer le patron « Dialogue modal et retour du focus » d'`accessibility-wcag` |
| Feuille basse | `ui/sheet.tsx` — jamais montée | Pas de styles sombres, croix ≈ 30 px, pas de hauteur maximale : à corriger avant le premier usage |
| Confirmation destructive | `ui/ConfirmDialog.tsx` | Boutons nommés par leur effet (« Vider le panier » / « Annuler ») [N10] |
| État vide | `ui/empty-state.tsx` (`icon`, `title`, `description`, `action`) — jamais montée | Toujours fournir `action` |
| Squelette | `ui/skeleton.tsx` (jamais montée), fichiers `loading.tsx` | Le squelette reprend les dimensions réelles |
| Statut | `ui/status-badge.tsx` (`OrderStatusBadge`, `ShopStatusBadge`) — jamais montée | Ses libellés diffèrent de `lib/design-tokens.ts` (« Partielle » / « Partiel. refusée ») : les aligner d'abord |
| Toast | `toast` de `sonner` 1.7.4 (`<Toaster position="top-center" richColors />` dans `app/layout.tsx`) | `action: { label, onClick }` pour « Annuler ». Un toast confirme ; il ne porte jamais seul une erreur à corriger (voir `accessibility-wcag` §8) |
| Prix | `formatPrice` (`lib/utils.ts`) → « 12,40 € » | 28 fonctions locales `fmtPrice` existent, plus d'autres variantes : n'en ajouter aucune |
| Poids, quantité | `formatGrams`, `formatStoredLineQuantity` (`lib/pricing/format.ts`, chantier) → « 500 g », « 1,5 kg », « 2 × 500 g », « 3 pièces » | Ne plus utiliser les deux `formatWeight` (`lib/utils.ts` → « 1.5 kg », `lib/estimate.ts` → « 1,5kg ») pour du texte neuf |
| Total d'une ligne, total à payer | `cartLineTotalCents` (`lib/cart/cart-line.ts`) pour l'estimation ; `useOrderQuote` (`lib/hooks/use-order-quote.ts`) pour ce qui est affiché sur `/panier` | Voir `click-and-collect` : aucune formule de prix dans un composant |
| « Pour combien de personnes » | `computeEstimation`, `formatEstimation` (`lib/estimate.ts`) | — |
| Image | `ui/SafeImage.tsx` | `aspect-[4/3] object-cover` pour les produits |
| Icônes | `lucide-react` uniquement (0.378.0 : poser `aria-hidden="true"` sur une icône décorative) | Pas d'émoji comme seule information |

## Deux patterns de code à connaître

Champ avec libellé visible et erreur reliée (`id` vient de `useId()`). Le composant complet `Field`, le résumé d'erreurs annoncé et les couleurs contrôlées sont dans `accessibility-wcag` (`references/patterns-composants.md` §9) : ne pas écrire un second `Field`.

```tsx
<label htmlFor={id} className="mb-1 block text-sm font-semibold">E-mail</label>
<input id={id} type="email" inputMode="email" autoComplete="email" enterKeyHint="next"
  aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined}
  className="min-h-[44px] w-full rounded-xl border px-4 text-base" />
{error && <p id={`${id}-err`} className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{error}</p>}
```

Annulation plutôt que confirmation pour un retrait de ligne (sonner 1.7.4, `useCart`) :

```tsx
removeItem(item.id);
toast(`${item.name} retiré du panier`, {
  duration: 8000,
  action: { label: "Annuler", onClick: () => addItem(item, shop) },
});
```

Versions complètes et vérifiées à la compilation (validation à la sortie du champ, sélecteur de créneau, annonce de statut, fenêtre horaire, clé d'idempotence, note de boutique) : [references/snippets.md](references/snippets.md). Formulaires et états en détail : [references/formulaires-et-etats.md](references/formulaires-et-etats.md).

## Voix et textes

- Français correct avec accents, partout, y compris dans les toasts et l'écran cuisine. Les chaînes sans accent (« Reessayer », « Prete », « Recuperee ») sont des défauts.
- Une seule adresse au client : **vouvoiement** (majoritaire dans l'application ; le formulaire invité tutoie — à uniformiser, point d'arbitrage ci-dessous).
- Prix « 12,40 € », poids « 500 g », « 1,5 kg », heure « 14h30 ». Jamais « livraison » : « frais offerts ».
- Un bouton dit ce qu'il fait : « Ajouter · 12,40 € », « Voir le panier », « Vider le panier ». Pas de « OK », « Valider », « Continuer » seuls [W5]. Le libellé du bouton final de commande est un sujet légal : voir `click-and-collect`, point A4.
- Un message d'erreur dit ce qui s'est passé et quoi faire : « Ce créneau vient d'être pris. Choisissez-en un autre. » Jamais « Erreur » ou « Oups » seul [N5].
- 16 px minimum dans les champs (un champ plus petit déclenche un zoom automatique sur Safari iOS — comportement connu de l'équipe, **non vérifié à la source** ; à contrôler sur appareil). Les champs de `/panier` sont en `text-sm` (14 px).

## Erreurs typiques de ce code (à ne pas reproduire)

1. Texte d'exemple utilisé comme libellé, erreurs non reliées au champ (`panier/page.tsx`, formulaire invité).
2. Modales écrites à la main sans `role="dialog"`, sans piège de focus (`WeightSheet.tsx`, `ProductSheet.tsx`), alors que `ui/dialog.tsx` et `ui/sheet.tsx` existent.
3. Cibles trop petites : 32 px (`QuantitySelector`), 36 px (pastilles, compteur de pièces), ≈ 34 px (cartes cuisine).
4. Note affichée sans avis (« 0.0 (0) ») ; minuteur à la seconde sur le suivi.
5. Même bloc écrit deux fois (créneau invité / connecté) : les textes divergeaient (réuni en un bloc par le chantier ; ne pas recommencer).
6. Libellés de statut recopiés dans sept fichiers ; 28 formateurs de prix locaux.
7. Demande de notification prévue 3 s après un chargement (`PushPrompt.tsx`), sans contexte — et jamais montée.
8. Squelette qui ne correspond pas à la page (héros 240 px contre 300 px).
9. Information portée par une info-bulle `title` ou par un émoji seul.
10. Chiffre de conversion cité sans source vérifiée dans un commentaire (« Baymard +23 % »).
11. Bouton final désactivé sans dire pourquoi (créneau non choisi) ; écran d'erreur « Oups » avec le message brut du serveur.

## Checklist avant de proposer un écran

- [ ] 375 px de large d'abord ; rien ne déborde ; la `BottomNav` et la zone sûre ne masquent rien.
- [ ] Clair et sombre ; contraste du texte secondaire vérifié.
- [ ] Toutes les actions tactiles ≥ 44 px, 8 px d'écart ; ≥ 48 px en cuisine.
- [ ] États couverts : chargement, vide, erreur réseau, erreur métier, hors ligne, non connecté, boutique fermée ou en pause.
- [ ] Chaque champ a un libellé visible, le bon `type`, `inputMode`, `autoComplete` ; les erreurs sont reliées et annoncées.
- [ ] Chaque geste a un retour en moins de 100 ms ; les envois ne peuvent pas partir deux fois.
- [ ] Parcours au clavier complet ; focus visible ; les feuilles piègent et rendent le focus.
- [ ] Animations coupées sous `prefers-reduced-motion`.
- [ ] Aucun chiffre, badge ou compte à rebours qui ne vienne d'une donnée réelle ; aucun prix calculé dans le composant.
- [ ] Aucun appel API ajouté au montage pour un visiteur anonyme, aucun `new Date()` dans le rendu initial d'une page prérendue (règles CLAUDE.md, voir `vercel-cost-performance`).
- [ ] Textes relus : accents, vouvoiement, verbes d'action, « frais offerts ».

## Définition de terminé (domaine UX)

(1) La checklist ci-dessus est cochée et jointe à la PR avec des captures 375 px clair et sombre ; (2) le parcours touché est rejoué sur un téléphone réel, en invité, d'une seule main ; (3) un test Playwright couvre le chemin nominal et un état d'échec (voir `testing-strategy`) ; (4) aucun composant nouveau ne double une brique du tableau ; (5) si un événement de conversion est concerné, sa mesure est décrite dans la PR ; (6) build, lint, typecheck et tests passent.

## Points à arbitrer (propriétaire)

- **Tutoiement ou vouvoiement.** Le code mélange les deux. Proposition : vouvoiement partout.
- **Compte à rebours de 5 s avant l'envoi de la commande** : friction voulue ou à remplacer par une annulation possible après envoi [N10] (voir `click-and-collect`, A3).
- **Catégories : filtre (actuel) ou menu long avec ancres.** À décider quand une boutique dépasse quelques dizaines de produits.
- **Règle CLAUDE.md « Images produits `aspect-[4/3]` »** : respectée. La carte boutique utilise une hauteur fixe (`h-36 sm:h-48`), pas un ratio — à harmoniser ou à assumer.
- **CLAUDE.md annonce « Font : Outfit »** dans les règles et « DM Sans (body), Outfit (display) » dans le design system : voir `design-klikgo`.
- **Cibles de 48 px en cuisine.** CLAUDE.md fixe 44 px ; ce skill recommande 48 px sur la tablette [W4]. À confirmer avant de l'exiger en revue.
- **Seuil d'affichage d'une note** (dès 1 avis, ou à partir de 5) et sort du drapeau « populaire », aujourd'hui saisi à la main par le boucher.
- **Mesure.** Aucun événement de conversion n'est émis dans `src/` (recherche de `plausible(`, `trackEvent`, `gtag(` le 14/11/2026 : aucun résultat ; Plausible ne compte que les pages, et seulement si `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` est défini). Sans mesure, les heuristiques ci-dessus restent des paris raisonnés : décider des événements à suivre ([references/confiance-et-persuasion.md](references/confiance-et-persuasion.md) §5).

## Références

- [references/patterns-ecrans.md](references/patterns-ecrans.md) — chaque surface, état actuel et cible.
- [references/formulaires-et-etats.md](references/formulaires-et-etats.md) — champs, validation, chargement, vide, erreur.
- [references/confiance-et-persuasion.md](references/confiance-et-persuasion.md) — preuves, avis, urgence, promotions, mesure.
- [references/snippets.md](references/snippets.md) — code vérifié à la compilation avec nos versions.
- [references/sources.md](references/sources.md) — sources, ce qu'elles prouvent, date de consultation.
