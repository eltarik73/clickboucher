# Formulaires et états d'interface

Identifiants de sources : [sources.md](sources.md). Code prêt à l'emploi : [snippets.md](snippets.md). Balisage accessible détaillé : `accessibility-wcag` (`references/patterns-composants.md`). État du code relu le 14/11/2026 sur l'arbre de travail.

## 1. Formulaires

Le projet n'utilise pas de bibliothèque de formulaires (pas de `react-hook-form`) : état local + validation Zod côté serveur. Garder cette approche pour les petits formulaires ; ne pas introduire de dépendance sans décision.

### Règles

| Règle | Raison | Source |
|---|---|---|
| Un `<label>` visible relié à chaque champ (`htmlFor` / `id`) | Le texte d'exemple disparaît, empêche la relecture, se confond avec une valeur saisie | [N1][W5] |
| Marquer **et** les champs obligatoires **et** les facultatifs | Bonne pratique Baymard ; la moitié des sites évalués ne la suivent pas | [B5] |
| Demander le minimum ; expliquer chaque donnée sensible (téléphone) | 68 % des répondants hésitent à donner leur téléphone | [B5][W5] |
| `type`, `inputMode`, `autoComplete`, `enterKeyHint` corrects | Bon clavier, remplissage automatique, moins de saisie | [W5] |
| Valider à la sortie du champ, jamais avant la première saisie ; effacer l'erreur dès que la valeur est bonne | Une erreur prématurée frustre ; une erreur qui reste trompe | [B4] |
| Erreur à côté du champ, en clair, avec la correction attendue ; saisie conservée | — | [N5] |
| Erreur reliée au champ (`aria-describedby`, `aria-invalid`) et annoncée (résumé `role="alert"` du formulaire à la soumission) | Critère WCAG 4.1.3 ; balisage : `accessibility-wcag` §9 | [W2] |
| Bouton d'envoi : jamais désactivé parce que le formulaire est incomplet ; désactivé pendant l'envoi, avec un libellé d'état | Un bouton inerte n'explique rien ; un double envoi crée un doublon | [W5] |
| Le libellé du bouton dit ce qu'il fait (« Voir le panier », « Choisir un créneau ») ; pour le bouton final de commande, voir `click-and-collect` point A4 | « Continuer » ne dit pas où l'on va | [W5] |
| Validation serveur dans tous les cas (Zod) | Règle CLAUDE.md | — |
| Un seul champ « nom » quand c'est possible | web.dev le recommande ; ici prénom et nom sont séparés car le comptoir appelle `Prénom.N` — exception assumée | [W5] |

### Formulaire invité : cible

| Champ | Attributs | Obligatoire | Aide |
|---|---|---|---|
| E-mail | `type="email" inputMode="email" autoComplete="email"` | oui | « Pour vous envoyer le lien de suivi. » |
| Prénom | `autoComplete="given-name"` | oui | « Le boucher vous appellera par ce prénom. » |
| Nom | `autoComplete="family-name"` | oui | — |
| Téléphone | `type="tel" inputMode="tel" autoComplete="tel"` | non | « Pour vous prévenir si un article manque. » |

Aujourd'hui (`panier/page.tsx`) : les attributs sont bons, mais chaque champ n'a qu'un texte d'exemple (« Email * », « Téléphone (recommandé) »), les erreurs ne sont pas reliées, tout est validé à l'appui sur le bouton final, et le bloc tutoie (« Tes infos pour la commande »).

Lien « J'ai un compte » : secondaire, au-dessus du formulaire, sans vider le panier (`/sign-in?redirect_url=/panier`, en place). La proposition de compte vient après la commande, sur l'écran de suivi [B3]. Code promo : le serveur le refuse à un invité (voir `click-and-collect`, point A14) ; tant que la décision tient, le dire (« Connectez-vous pour utiliser un code ») plutôt que masquer le champ sans explication.

### Contrôles de quantité

- « − n + » plutôt qu'un menu déroulant ou un champ seul ; mise à jour immédiate ; 0 retire la ligne ; « Annuler » proposé [B11].
- Compteur avec saisie libre quand la plage est large (poids) ; bornes visibles ; bouton grisé à la borne ; valeur par défaut la plus fréquente [N7].
- Poids : préréglages d'abord (un appui), saisie ensuite.
- Bornes : l'écran applique celles du produit (`minWeightG`, `weightStepG`, `maxWeightG`) ; le serveur refuse au-delà de 99 portions ou de 50 kg par portion (`checkLineQuantity`). Désactiver « + » à la borne plutôt que laisser l'ajout échouer : le reducer du panier ignore une ligne non recevable, et la page boutique ne prévient que pour un produit au poids (« Cette quantité ne peut pas être commandée en ligne »).

## 2. Chargement

| Durée attendue | Réponse | Source |
|---|---|---|
| < 1 s | Rien de particulier (pas de squelette qui clignote) | [N3] |
| Chargement d'une page, < 10 s | Squelette aux dimensions de la page réelle | [N3] |
| Un module isolé, 2–10 s | Indicateur local (`Loader2` qui tourne) + texte | [N3] |
| > 10 s | Progression explicite + possibilité d'annuler | [N2][N3] |

Règles propres au projet :
- Chaque route a son `loading.tsx` ; il reprend les hauteurs réelles (le héros de la boutique fait 300 px, son squelette 240 px : à aligner). CLAUDE.md : le squelette de l'accueil est sur fond blanc.
- Un rafraîchissement en arrière-plan (polling) ne remplace jamais le contenu par un squelette : on garde l'ancien état jusqu'à la réponse (modèle : `commande/[id]/page.tsx`, `orderLoadedRef`).
- Le devis du panier se recalcule à chaque changement : pendant le calcul, garder l'estimation locale affichée et dire « Calcul du total… » (en place, `aria-live="polite"`), ne pas vider la zone.
- « Chargement... » en texte seul (créneaux, attente de la session sur `/panier`) : remplacer par un squelette de la zone, de même hauteur, pour éviter le saut de mise en page.
- Squelettes animés : NN/g signale que l'animation peut distraire ou gêner [N3] ; la couper sous `prefers-reduced-motion` (`motion-safe:animate-pulse`, choix d'équipe).

## 3. États vides

Trois éléments à chaque fois : **ce qui se passe**, **à quoi sert la zone**, **l'action** [N9]. Utiliser `ui/empty-state.tsx` avec `action` renseignée (brique jamais montée à ce jour : vérifier son rendu au premier usage).

| Zone | Texte cible | Action |
|---|---|---|
| Panier | « Votre panier est vide. » | « Voir les boucheries » (en place, sous le libellé « Découvrir les boucheries ») ; si une boutique vient d'être quittée, « Retourner chez {boutique} » |
| Commandes | « Aucune commande pour l'instant. Vos commandes apparaîtront ici, avec leur suivi. » | « Voir les boucheries » |
| Favoris | « Touchez le cœur d'une boucherie pour la retrouver ici. » | « Voir les boucheries » |
| Recherche sans résultat | « Aucun résultat pour “merguez de veau”. » + suggestion | Catégories proches, effacer la recherche |
| Catégorie sans produit | « Rien dans cette catégorie aujourd'hui. » | « Voir tout » |
| Aucun créneau | « Plus de créneau disponible ce jour. » | « Voir demain » |
| Aucune boutique ouverte | « Aucune boucherie ouverte pour l'instant. La prochaine ouvre à 8h30. » | Voir les boutiques fermées, précommander si possible |
| Avis | « Pas encore d'avis. » | Aucune (ne pas solliciter ici) |

Ne jamais afficher un état vide pendant que la donnée charge : un « aucune commande » suivi de commandes deux secondes plus tard fait douter de l'application [N9].

## 4. Erreurs

| Type | Où | Forme | Exemple |
|---|---|---|---|
| Champ | Sous le champ | Texte + bordure, relié au champ | « Saisissez une adresse e-mail valide, par exemple nom@exemple.fr. » |
| Métier (refus serveur) | Près de la zone concernée, la page reste en place | Encadré avec action | « Ce créneau vient d'être complet. Choisissez-en un autre. » |
| Réseau | Près du bouton d'envoi | Encadré + « Réessayer » | « Connexion interrompue. Votre panier est conservé. » |
| Page | `error.tsx` du segment | Écran avec « Réessayer » et retour | En place (`app/(client)/error.tsx`) |
| Introuvable | `not-found` | Écran avec sortie | Boutique : 404 déclenché dans `generateMetadata` |

Règles :
- Une erreur qui demande une action s'affiche près du problème et y reste [N5]. Un toast disparaît : il confirme, il ne sert pas à corriger (même règle dans `accessibility-wcag` §8).
- Jamais « Erreur », « Oups » ou un code seul. Dire ce qui s'est passé et quoi faire. Contre-exemple actuel : l'écran d'envoi (`OrderCountdown`) titre « Oups, une erreur est survenue » et affiche le message brut du serveur ; la table des codes de refus et de leurs actions est dans `click-and-collect` (`references/parcours-client.md` §5).
- Ne pas blâmer (« Vous avez mal saisi… ») [W5][N5].
- `error.tsx` journalise aujourd'hui avec `console.error` : la règle CLAUDE.md demande le `logger` ; voir `reliability-observability`.
- Une erreur de polling ne remplace pas l'écran en cours (modèle : `fetchOrder` de `commande/[id]/page.tsx`).

## 5. Confirmations et annulations

- Geste fréquent et rattrapable (retirer une ligne, retirer un favori) : exécuter, puis proposer « Annuler » dans le toast [N10][B11].
- Geste grave ou irréversible (vider le panier, annuler une commande, refuser une commande) : `ConfirmDialog`, qui rappelle l'objet et nomme les boutons par leur effet [N10].
- Pas de dialogue en chaîne ; pas de question générique « Êtes-vous sûr ? » [N10].

## 6. Feuilles et dialogues

- Tâche courte uniquement ; croix visible ; Échap et retour arrière ferment ; pas d'empilement [N6].
- Rôle `dialog`, nom accessible, focus piégé puis rendu à l'élément d'origine [W3]. Radix (`ui/sheet.tsx`, `ui/dialog.tsx`) fournit le rôle, le piège et Échap ; il ne rend le focus qu'à un `Dialog.Trigger`, que le code n'utilise pas : appliquer le patron §3 d'`accessibility-wcag`.
- Le fond ne défile pas ; le contenu défile dans la feuille (`max-h` + `overflow-y-auto`) ; le bouton principal reste visible en bas.
- NN/g note que l'argument « plus facile à atteindre au pouce » est en grande partie faux : choisir une feuille pour garder le contexte, pas pour l'ergonomie [N6].

## 7. Notifications et permissions

- Position : uniquement sur un geste ; valeur expliquée ; repli sur la ville saisie (en place dans `ReorderSection.tsx`, « Saisir ville »).
- Notifications : demande en contexte, après la commande, précédée d'un écran maison qui explique le bénéfice ; si refus, ne pas redemander dans la session ; toujours offrir un moyen de couper [W6]. Sur iPhone, seulement si le site est installé sur l'écran d'accueil [W8].
- Aucune demande de permission au chargement d'une page [W6].
