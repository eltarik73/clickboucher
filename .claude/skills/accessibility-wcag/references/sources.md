# Sources — skill `accessibility-wcag`

Toutes les sources ont été consultées le **2026-11-13**, puis rouvertes une à une lors de la relecture indépendante du **2026-11-14** (`[V9]`). Chaque affirmation externe du skill renvoie à un identifiant de ce fichier (`[W1]`, `[A2]`, `[L1]`…). Les affirmations sur notre code renvoient aux vérifications locales `[V1]`–`[V9]`.

Barre de qualité appliquée : spécifications W3C, documentation officielle des outils installés, textes officiels français, dépôts GitHub officiels ou à forte adoption. Les dépôts W3C et `axe-core-npm` ont moins de 3 000 étoiles : ils sont retenus parce que ce sont les dépôts officiels de la norme ou de l'outil, pas pour leur popularité.

## W3C — WCAG 2.2 et fiches « Understanding »

| ID | URL | Ce que la source appuie | Crédibilité |
|---|---|---|---|
| W1 | https://www.w3.org/TR/WCAG22/ | Statut « W3C Recommendation, 12 December 2024 ». Texte normatif de 1.3.4, 1.3.5, 1.4.3, 1.4.10, 1.4.11, 2.5.3. Définition du « grand texte » (18 pt, ou 14 pt gras). Numéros et niveaux de tous les critères cités. | Norme W3C |
| W2 | https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ | Les 9 critères ajoutés par WCAG 2.2 (2.4.11, 2.4.12, 2.4.13, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8, 3.3.9), leur niveau, le retrait de 4.1.1. Première publication le 5 octobre 2023. | W3C WAI |
| W3 | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 2.5.8 : cible ≥ 24 × 24 px CSS, cinq exceptions, méthode du cercle de 24 px, renvoi vers 2.5.5 (44 px, AAA) pour les contrôles importants. | W3C WAI |
| W4 | https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html | 2.4.11 : l'élément focalisé ne doit pas être entièrement masqué par du contenu de l'auteur (en-têtes et pieds collants, bandeaux) ; technique `scroll-padding`. | W3C WAI |
| W5 | https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | 4.1.3 : définition d'un message d'état, rôles `status` / `alert` / `log`, exemple du panier (« 5 articles »). | W3C WAI |
| W6 | https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html | 2.2.1 : désactiver, ajuster ou prolonger une limite de temps ; exceptions ; cas des messages temporaires (toasts). | W3C WAI |
| W7 | https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html | 2.2.2 : contenu animé de plus de 5 s présenté en parallèle ; contenu mis à jour automatiquement ; cas des animations de chargement. | W3C WAI |
| W8 | https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html | 2.3.1 : pas plus de trois flashs par seconde ; distinction clignotement / flash. | W3C WAI |
| W9 | https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html | 1.4.2 : son automatique de plus de 3 s, mécanisme d'arrêt ou de volume indépendant. | W3C WAI |
| W10 | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | 1.4.3 : 18 pt ≈ 24 px, 14 pt ≈ 18,5 px ; le texte indicatif (placeholder) est couvert ; composants inactifs exclus ; pas d'arrondi (4,499:1 échoue). | W3C WAI |
| W11 | https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html | 1.4.11 : 3:1 pour les indices visuels d'un composant et de ses états ; bordure de champ si c'est le seul indice ; indicateur de focus stylé par l'auteur ; composants inactifs exclus. | W3C WAI |
| W12 | https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html | 3.3.7 : ne pas redemander une information déjà saisie dans le même processus ; l'auto-complétion du navigateur ne suffit pas ; conserver la saisie après une erreur de paiement. | W3C WAI |
| W13 | https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html | 3.3.8 : pas de test cognitif sans alternative ; ne pas bloquer le collage ni les gestionnaires de mots de passe ; lien magique, WebAuthn, OAuth acceptés. | W3C WAI |
| W14 | https://www.w3.org/WAI/test-evaluate/preliminary/ | Les 10 « Easy Checks » (titre, alternatives, titres, contraste, zoom, clavier, formulaires, mouvement, multimédia, structure). Page mise à jour le 9 août 2023. | W3C WAI |
| W15 | https://www.w3.org/WAI/tutorials/forms/notifications/ | Résumé d'erreurs en tête de formulaire, message par champ relié par `aria-describedby`, `role="alert"` sans rechargement, focus sur le premier champ en erreur, moment de la validation. | W3C WAI |
| W16 | https://www.w3.org/WAI/tutorials/forms/labels/ | `label for`/`id` mieux supporté que l'étiquette englobante ; `aria-label` seulement si le contexte visuel suffit ; `title` « généralement moins fiable et déconseillé » comme étiquette. La page ne dit rien du clavier ni du tactile : voir `[T15]`. | W3C WAI |
| W17 | https://www.w3.org/WAI/tutorials/forms/instructions/ | Le texte indicatif (placeholder) ne remplace pas une étiquette ; les lecteurs d'écran ne le traitent pas comme telle ; sa couleur par défaut manque souvent de contraste. | W3C WAI |
| W18 | https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html | 1.4.1 : deux couleurs qui diffèrent aussi en luminosité, avec un ratio d'au moins 3:1 entre elles, ne sont pas « la couleur seule » ; si la teinte elle-même porte le sens (vert valide, rouge invalide), un autre indice reste exigé. | W3C WAI |

## W3C — ARIA Authoring Practices Guide (APG)

Dépôt : `w3c/aria-practices` — 1 364 étoiles, dernier push 2026-11-13, non archivé.

| ID | URL | Ce que la source appuie |
|---|---|---|
| A1 | https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/ | « No ARIA is better than Bad ARIA » ; un rôle est une promesse de comportement clavier ; support mobile et tactile non garanti. |
| A2 | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Dialogue modal : focus initial (action la moins destructrice pour une étape irréversible), Tab en boucle, Échap, retour du focus, `aria-modal` seulement si l'arrière-plan est réellement inerte. |
| A3 | https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/ | `role="alertdialog"` pour un message important qui exige une réponse ; `aria-describedby` vers le message. |
| A4 | https://www.w3.org/WAI/ARIA/apg/patterns/alert/ | Une alerte ne déplace pas le focus ; éviter la disparition automatique et les alertes fréquentes. |
| A5 | https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ | `tablist` / `tab` / `tabpanel`, `aria-selected`, flèches, Home/End, activation automatique si le panneau s'affiche sans délai. |
| A6 | https://www.w3.org/WAI/ARIA/apg/patterns/switch/ | `role="switch"`, `aria-checked`, nom accessible, l'étiquette ne change pas avec l'état. |
| A7 | https://www.w3.org/WAI/ARIA/apg/patterns/radio/ | `radiogroup` : Tab entre sur le bouton coché, les flèches déplacent et cochent. |

## Outils — documentation officielle et dépôts

Chiffres GitHub relevés avec `gh api repos/OWNER/REPO` le 2026-11-13.

| ID | Source | Ce que la source appuie | Crédibilité |
|---|---|---|---|
| T1 | https://playwright.dev/docs/accessibility-testing | `@axe-core/playwright`, `AxeBuilder`, `withTags`, `include`/`exclude`, `disableRules`, empreintes de violations, fixture partagée, `testInfo.attach`. Rappel : beaucoup de problèmes ne se détectent que manuellement. | Doc officielle ; `microsoft/playwright` 100 049 étoiles, push 2026-11-13 |
| T2 | https://playwright.dev/docs/aria-snapshots | `toMatchAriaSnapshot`, format YAML, correspondance partielle, `--update-snapshots`. | Doc officielle |
| T3 | https://github.com/dequelabs/axe-core (README) | axe-core trouve « en moyenne 57 % » des problèmes WCAG automatiquement ; zéro faux positif visé ; résultats `incomplete` à revoir à la main. | Dépôt officiel ; 7 807 étoiles, push 2026-11-13, non archivé |
| T4 | https://github.com/dequelabs/axe-core/blob/develop/doc/API.md | Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`, `EN-301-549`, `RGAAv4` ; tableaux `violations` / `incomplete` ; niveaux d'impact. | Dépôt officiel |
| T5 | `npm view @axe-core/playwright` | Version 4.14.0, dépend de `axe-core ~4.14.0`, pair `playwright-core >= 1.0.0`. | Registre npm ; `dequelabs/axe-core-npm` 736 étoiles, push 2026-11-06 |
| T6 | https://www.radix-ui.com/primitives/docs/components/dialog | Suit le patron APG du dialogue ; piège du focus ; Échap ; `Dialog.Title` et `Dialog.Description` ; `aria-describedby={undefined}`. | Doc officielle ; `radix-ui/primitives` 19 495 étoiles, push 2026-10-14 |
| T7 | https://www.radix-ui.com/primitives/docs/components/alert-dialog | Existence d'une primitive AlertDialog conforme au patron APG « Alert and Message Dialogs ». | Doc officielle |
| T8 | https://nextjs.org/docs/architecture/accessibility | Annonceur de route (lit `document.title`, puis le `h1`, puis le chemin) ; règles `jsx-a11y` incluses dans `eslint-config-next`. Page datée du 2024-11-06. | Doc officielle Next.js |
| T9 | https://v3.tailwindcss.com/docs/hover-focus-and-other-states | Variantes `motion-reduce`, `motion-safe`, `focus-visible`, `aria-*`, `contrast-more`, `forced-colors`. | Doc officielle ; `tailwindlabs/tailwindcss` 98 588 étoiles |
| T10 | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions | La région live doit exister, vide, avant la mise à jour ; `polite` par défaut, `assertive` réservé au critique ; `aria-atomic`. | MDN |
| T11 | https://web.dev/articles/prefers-reduced-motion | Troubles vestibulaires ; retirer le mouvement non essentiel ; ne pas couper aveuglément toutes les animations ; `matchMedia`. | web.dev (Google) |
| T12 | https://github.com/emilkowalski/sonner | Bibliothèque de toasts utilisée. Comportement vérifié localement `[V1]`, pas dans la doc. | 13 209 étoiles, push 2026-08-10 |
| T13 | https://github.com/jsx-eslint/eslint-plugin-jsx-a11y | Règles de lint. Liste vérifiée localement `[V1]`. | 3 631 étoiles, push 2026-01-06 |
| T14 | https://github.com/shadcn-ui/ui | Origine de nos primitives `ui/*`. Cité pour contexte uniquement. | 128 063 étoiles, push 2026-11-12 |
| T15 | https://html.spec.whatwg.org/multipage/dom.html#the-title-attribute | S'appuyer sur `title` est déconseillé : l'infobulle demande un pointeur, ce qui exclut les utilisateurs du clavier seul et du tactile seul. | Norme HTML (WHATWG) |
| T16 | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button | Note « Clicking and focus » : la plupart des navigateurs focalisent un bouton cliqué, Safari non, par choix de conception. | MDN |

Chiffres recoupés le 2026-11-14 avec la même commande : `axe-core` 7 818 étoiles, `playwright` 100 125, `radix-ui/primitives` 19 500 (push 2026-10-14), `aria-practices` 1 364, `sonner` 13 215, `eslint-plugin-jsx-a11y` 3 631, aucun dépôt archivé.

## Droit français et européen

| ID | Source | Ce que la source appuie | Crédibilité |
|---|---|---|---|
| L1 | https://handicap.gouv.fr/sites/handicap/files/2025-07/Fiche-conso-DGCCRF.pdf | Fiche d'information DGCCRF « à destination des consommateurs » sur la directive (UE) 2019/882 : commerce électronique listé parmi les services ; autorités (DGCCRF, avec ARCOM, ARCEP, Banque de France, ACPR, AMF) ; exemption de taille : « moins de 10 salariés avec un chiffre d'affaires annuel ou total de bilan inférieur à 2 millions d'euros », « aucune obligation en matière d'accessibilité ne s'impose aux prestataires de services » ; exemptions « modification fondamentale » et « charge disproportionnée » ; calendrier 28 juin 2025 / 28 juin 2030 ; SignalConso ; références L. 412-13, D. 412-49 à D. 412-62, R. 451-4-I, arrêté du 9 octobre 2023 ; EN 301 549 V3.2.1 (2021-06), RGAA, WCAG 2.1. Le PDF ne porte pas de date (« 2025-07 » vient de son adresse) et écrit « RGAA v4.2.1 » pour 4.1.2. Texte extrait avec `pdftotext` et relu en entier `[V9]`. | Document officiel (Gouvernement) |
| L2 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000048178349 | Décret n° 2023-931 du 9 octobre 2023 (JORF du 10 octobre 2023) : crée D. 412-49 à D. 412-62 et R. 451-4 du code de la consommation ; s'applique aux services fournis après le 28 juin 2025 ; contravention de 5ᵉ classe. Le seuil « moins de dix personnes » et chiffre d'affaires ou bilan « n'excède pas deux millions d'euros » y figure à l'article D. 412-60, II et IV : il dispense d'apporter des preuves et de notifier les autorités. L'exemption générale des prestataires de services n'est pas dans le décret : elle vient de la loi (L. 412-13, non relu), telle que la résume `[L1]`. | Journal officiel |
| L3 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048180389 | Art. D. 412-57 (version en vigueur depuis le 11 octobre 2023) : obligations des prestataires de services (concevoir conforme, préparer et publier l'information sur la conformité par écrit et à l'oral, la conserver tant que le service est proposé, maintenir, corriger et informer les autorités, répondre et coopérer). | Légifrance |
| L4 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417256 | Art. 131-13 du code pénal : amende de 5ᵉ classe = 1 500 € au plus, 3 000 € en récidive si le règlement le prévoit. | Légifrance |
| L5 | https://accessibilite.numerique.gouv.fr/ | RGAA 4.1.2 (publié le 16 septembre 2019, mis à jour le 18 avril 2023), 106 critères ; version 5 en rédaction, publication prévue fin 2026. | Site officiel (DINUM) |
| L6 | https://accessibilite.numerique.gouv.fr/obligations/champ-application/ | Qui est soumis au RGAA (art. 47 de la loi n° 2005-102) : secteur public, délégataires, entreprises de plus de 250 M€ de CA en France ; référence EN 301 549 V2.1.2 ; WCAG 2.1 A et AA. | Site officiel (DINUM) |
| L7 | https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/ | Les 13 thématiques du RGAA. | Site officiel (DINUM) |
| L8 | https://design.numerique.gouv.fr/articles/2025-07-31-european-accessibility-act/ | La directive s'applique depuis le 28 juin 2025 ; e-commerce cité parmi les services ; RGAA pour les services publics et les entreprises au-dessus de 250 M€. | DesignGouv (DINUM), 31 juillet 2025 |

## Vérifications locales (dépôt au commit `161f920`)

| ID | Vérification | Résultat utile |
|---|---|---|
| V1 | Lecture de `node_modules` | `@radix-ui/react-dialog` 1.1.15 : `role: "dialog"` suivi de `...contentProps` (le rôle est surchargeable), `FocusScope`, `RemoveScroll`, `hideOthers`, avertissements titre et description, et `onCloseAutoFocus` qui annule le retour de focus par défaut puis focalise `triggerRef` (nul sans `Dialog.Trigger`). `sonner` 1.7.4 : `<section aria-live="polite" aria-relevant="additions text" aria-atomic="false">`, `containerAriaLabel`, durée 4 000 ms, libellé de fermeture figé `"Close toast"`. `axe-core` 4.11.1 (transitif via `eslint-config-next` → `eslint-plugin-jsx-a11y`) : 104 règles, 66 taguées `RGAAv4`, `target-size` seule règle `wcag22aa` et désactivée par défaut, activée par le tag. `@playwright/test` 1.59.1 : `toMatchAriaSnapshot`, `toHaveAccessibleName`, `toHaveRole`, `emulateMedia({ reducedMotion })`. `eslint-config-next` 14.2.35 : 6 règles `jsx-a11y` en `warn`. `eslint-plugin-jsx-a11y` 6.10.2 : 39 règles, configurations `recommended` et `strict`. `lucide-react` 0.378.0 : pas d'`aria-hidden` par défaut. `tailwind-merge` 2.6.1 : `extendTailwindMerge` disponible. |
| V2 | `scripts/contrast.mjs` (formule de luminance relative WCAG) | Tous les ratios de `references/audit-code-2026-11.md`. Recoupés par axe : 4,48 et 4,09 retrouvés à l'identique en production. |
| V3 | Scan axe 4.11.1 en lecture seule de `https://klikandgo.app` (Pixel 7 émulé, thèmes clair et sombre), le 2026-11-13 | Base de référence de `references/audit-code-2026-11.md`. Le commit déployé n'a pas été vérifié. Rejoué le 2026-11-14 avec le même script : mêmes règles et mêmes nombres de nœuds sur les dix scans (boutique : 26 et 49 contrastes, 40 imbrications ; accueil sombre : 6 contrastes). |
| V4 | `tsc --noEmit` (strict, `tsconfig.json` du dépôt) sur chaque extrait de `references/patterns-composants.md` et `references/tests-playwright-axe.md` | Aucun diagnostic. La variante `@axe-core/playwright` n'a pas pu être compilée : le paquet n'est pas installé. |
| V5 | `grep` sur `src/` | Les comptages du tableau « chiffres clés ». |
| V6 | Exécution des specs d'exemple avec le runner Playwright du dépôt (Chromium 1208 local), en lecture seule contre la production, le 2026-11-13 | Version stricte (zéro violation attendue) : 5 tests passent, 6 échouent (scans sombres, `/panier` clair, mouvement réduit). Version « garde-fou » avec la liste `KNOWN` : 10 tests sur 10 passent. Non rejoué le 2026-11-14. |
| V7 | Exécution de `@radix-ui/react-dialog` 1.1.15 dans jsdom (React 18.3.1), ouverture par état puis Échap | Sans `Dialog.Trigger` : focus sur `<body>` à la fermeture. Avec l'enveloppe du patron §3 : focus rendu à l'ouvreur. `role="alertdialog"` transmis à `Content` : rôle appliqué. `role={undefined}` transmis : plus aucun rôle. Rejoué le 2026-11-14 avec six cas de plus (`[V9]`). jsdom n'est pas un navigateur : le contrôle réel reste à faire. |
| V8 | Première relecture (2026-11-13) : `tsc --noEmit` sur les extraits, `twMerge` 2.6.1 exécuté sur la sortie de `buttonVariants`, script `scripts/a11y-counts.mjs` | `cn()` : la taille par défaut perd `text-body`, les tailles `sm` et `lg` perdent la couleur du texte ; `extendTailwindMerge` avec le groupe `font-size` conserve les deux. 108 `<Button>`, 46 avec `size="sm"` ou `"lg"`, aucun en `xl`. |
| V9 | Seconde relecture indépendante, 2026-11-14, sur l'arbre de travail (HEAD `32c581f` + chantier non commité) et sur `git archive 161f920` | Comptages rejoués aux deux états (identiques à `161f920` et `32c581f` ; l'arbre de travail a bougé, voir l'audit §0). Toutes les lignes citées de l'audit relues à `161f920`. Ratios recalculés. `axe.run` dans jsdom : `target-size` ne tourne qu'avec le tag `wcag22aa`, les règles `best-practice` et `experimental` ne tournent pas avec les tags WCAG seuls. Tailwind 3.4.19 compilé avec notre config : `dark:` produit `:is(.dark *)` (descendants seulement), `motion-safe:animate-ring` ne produit rien, `aria-selected:`, `aria-pressed:`, `min-h-11`, `focus-visible:after:ring-2` existent. Radix dans jsdom : cas « bouton non focalisé » (Safari), avec et sans `Dialog.Trigger`, ouvreur retiré. `grep` : aucun `animationend` dans `src/`. ESLint avec les règles du fichier « tests » §6 : 0 erreur, 162 avertissements, code de sortie 0. Les 15 extraits de `patterns-composants.md` et les 3 specs de `tests-playwright-axe.md`, extraits tels quels des fichiers, recompilés (`tsc --noEmit`, strict) : aucun diagnostic. L'enveloppe du §3, le `ConfirmDialog` du §4 et l'alerte du §5 exécutés dans jsdom : rôles, nom, description, focus initial, clic extérieur et retour du focus conformes aux tableaux des patrons. |

## Sources écartées ou non vérifiées

- **Reddit** : le domaine est inaccessible à nos outils de recherche. Aucune affirmation issue de Reddit n'est utilisée.
- **YouTube et conférences** : aucune transcription consultée, donc aucune source vidéo.
- **Instacart, « Making an accessible web modal »** : l'URL redirige selon la géographie vers une page d'accueil ; l'article n'a pas été lu. Non utilisé.
- **Texte de la directive (UE) 2019/882 sur EUR-Lex** et **article L. 412-13 sur Légifrance** : les pages n'ont pas pu être lues (ni le 13 ni le 14 novembre). L'exemption de taille des prestataires de services repose donc sur le seul résumé officiel `[L1]` ; `[L2]` et `[L3]` ont été lus sur Légifrance.
- **Fiches pratiques DGCCRF sur economie.gouv.fr** : HTTP 403. Remplacées par le PDF `[L1]`.
- **Commentaires d'avocats sur un jugement du tribunal judiciaire de Lille (mai 2026, grande distribution)** : source secondaire, non recoupée. Mentionné seulement comme point de veille dans `references/cadre-legal-france.md`.
- **Chiffres « 30 % » ou « 30–40 % » de couverture des outils automatiques** (blogs, éditeurs) : non retenus. Seul le chiffre publié par le projet axe-core est cité `[T3]`.
- **Recommandations de taille de cible d'Apple et de Google** : non consultées, non citées.
- **Amende quintuplée pour les personnes morales (art. 131-41 du code pénal)** : non relu à la source, non cité comme règle.
