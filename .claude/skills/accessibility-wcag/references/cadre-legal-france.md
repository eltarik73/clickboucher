# Cadre légal français de l'accessibilité numérique — lecture pour Klik&Go

Ceci est une lecture d'ingénieur des textes officiels, pas un avis juridique. Le skill `conformite-france` portera les obligations légales du projet (il n'est pas encore écrit au 2026-11-14) : dès qu'il existe, il prévaut en cas d'écart. Toute décision engageante passe par l'owner. Identifiants entre crochets : `sources.md`.

## 1. Deux régimes distincts

| | RGAA (loi de 2005) | Directive « accessibilité » (European Accessibility Act) |
|---|---|---|
| Texte | Article 47 de la loi n° 2005-102 `[L6]` | Directive (UE) 2019/882, transposée par l'article L. 412-13 et les articles D. 412-49 à D. 412-62 du code de la consommation (décret n° 2023-931 du 9 octobre 2023), exigences fixées par l'arrêté du 9 octobre 2023 `[L1][L2]` |
| Qui | Secteur public, délégataires de service public, entreprises de plus de 250 M€ de chiffre d'affaires en France `[L6]` | Opérateurs économiques de produits et services listés, dont **le commerce électronique** `[L1][L8]` |
| Depuis | En vigueur | Services fournis après le **28 juin 2025** `[L1][L2]` |
| Référentiel | RGAA 4.1.2 : 106 critères, 13 thématiques ; EN 301 549 V2.1.2 ; WCAG 2.1 A et AA `[L5][L6][L7]` | La fiche DGCCRF cite EN 301 549 V3.2.1 (2021-06), le RGAA et WCAG 2.1 `[L1]` |
| Contrôle | Voir le site du RGAA | DGCCRF pour le commerce électronique, en coordination avec ARCOM, ARCEP, Banque de France, ACPR, AMF `[L1]` |
| Sanction | Non relevée dans les pages lues | Contravention de 5ᵉ classe (R. 451-4) : 1 500 € au plus, 3 000 € en récidive `[L1][L2][L4]` |

Klik&Go n'entre dans aucune catégorie du RGAA `[L6]`. Le régime qui le concerne potentiellement est le second.

## 2. Ce que la directive demande à un service de commerce électronique

Selon la fiche DGCCRF `[L1]`, les sites et applications doivent être perceptibles, utilisables, compréhensibles et robustes : ce sont les quatre principes de WCAG. La fiche cite en exemples les équivalents textuels, l'usage au clavier, le temps suffisant, l'absence de contenu déclenchant des crises, l'aide à la correction des erreurs de saisie, la compatibilité avec les technologies d'assistance.

Obligations du prestataire de services (article D. 412-57) `[L3]` :

1. concevoir et fournir le service conformément aux exigences ;
2. préparer l'information expliquant comment le service y répond, et la mettre à disposition du public par écrit et à l'oral, y compris dans des formats accessibles, aussi longtemps que le service est proposé ;
3. maintenir la conformité quand le service ou les normes évoluent ;
4. en cas de non-conformité, corriger et informer les autorités ;
5. répondre aux demandes motivées des autorités.

Les services d'assistance (aide, centre d'appel) doivent renseigner sur l'accessibilité du service par des moyens eux-mêmes accessibles `[L1]`.

## 3. Exemptions

- **Taille.** Selon la fiche DGCCRF, pour les entreprises « employant moins de 10 salariés avec un chiffre d'affaires annuel ou total de bilan inférieur à 2 millions d'euros », « aucune obligation en matière d'accessibilité ne s'impose aux prestataires de services » `[L1]`. Cette exemption vient de la loi (article L. 412-13), que nous n'avons pas pu relire : elle repose ici sur ce seul résumé officiel. Le décret emploie le même seuil (moins de dix personnes, chiffre d'affaires ou bilan n'excédant pas deux millions d'euros) à l'article D. 412-60, pour dispenser ces entreprises d'apporter des preuves et de notifier les autorités `[L2]`.
- **Modification fondamentale** de la nature du service.
- **Charge disproportionnée**, selon des critères fixés par la réglementation ; elle se justifie et se déclare `[L1][L2]`.

Dispositions transitoires : les contrats de services conclus avant le 28 juin 2025 courent sans modification jusqu'à leur terme, au plus tard le 28 juin 2030 `[L1]`.

Un consommateur peut signaler un manquement sur SignalConso `[L1]`.

## 4. Lecture pour Klik&Go

**Aujourd'hui.** Si la société qui exploite Klik&Go emploie moins de 10 personnes et reste sous 2 M€ de chiffre d'affaires ou de bilan, elle relève de l'exemption de taille en tant que prestataire de services. C'est à l'owner de le confirmer avec les chiffres de la société.

**Ce qui met fin à l'exemption.** Atteindre dix personnes, ou dépasser à la fois 2 M€ de chiffre d'affaires et 2 M€ de bilan (lecture du seuil tel que le formulent `[L1]` et `[L2]` ; le mode de calcul de l'effectif n'a pas été étudié). L'objectif affiché du produit (le niveau d'Uber Eats ou de Deliveroo) y mène. Corriger au fil de l'eau évite de reprendre tout le produit le jour où l'exemption tombe.

**Questions ouvertes, à trancher par l'owner et un conseil.**

- Sur une place de marché, qui est le prestataire du service de commerce électronique : la plateforme, chaque boucherie, ou les deux ? Les textes lus ne le disent pas.
- L'outil du boucher (mode cuisine, tableau de bord) est un outil professionnel, pas un service au consommateur : il sort a priori du champ de la directive. Le droit du travail et l'accessibilité du poste d'un salarié handicapé relèvent d'autres textes, non étudiés ici.
- Quand le paiement en ligne Stripe sera activé, la page de paiement hébergée entre-t-elle dans le périmètre ? WCAG traite un paiement délégué à un tiers comme une étape du même processus `[W12]`.

**Pourquoi viser WCAG 2.2 AA sans y être obligé.**

- WCAG 2.2 reprend les critères A et AA de WCAG 2.1 (référence du RGAA et de la fiche DGCCRF), en ajoute neuf et n'en retire qu'un, 4.1.1 `[W2]`. Viser 2.2 AA, c'est être prêt pour les deux régimes.
- Les défauts relevés dans l'audit sont d'abord des défauts de produit : bouton illisible, formulaire sans étiquette, focus perdu.
- Le RGAA 5 est en rédaction, publication annoncée pour fin 2026 `[L5]` : la référence française va bouger, WCAG 2.2 est la base la plus stable.

## 5. À préparer pour le jour où l'exemption tombe

Rien de ceci n'est exigé d'une microentreprise `[L1]`. C'est la liste de ce que demande l'article D. 412-57 `[L3]`, à anticiper :

1. Une page d'information sur l'accessibilité du service : ce qui est conforme, ce qui ne l'est pas, comment obtenir de l'aide. Créer une page publique touche l'indexation : passer par les skills `seo-expert` et `seo-anti-penalty` avant de la publier.
2. Un canal de contact accessible (le formulaire `/contact` rendu conforme, une adresse email).
3. Un audit de référence daté, et la trace des corrections : `references/audit-code-2026-11.md` en est le point de départ.
4. Une procédure de maintien : les tests de `tests-playwright-axe.md` dans la CI, et la « définition de terminé » du skill.

## 6. Veille

- **RGAA 5**, prévu fin 2026 `[L5]`.
- **Jurisprudence.** Des commentaires d'avocats font état d'une décision du tribunal judiciaire de Lille (mai 2026) sur l'articulation entre l'article L. 412-13 et le seuil de 250 M€ de la loi de 2005, dans une affaire de grande distribution. Source secondaire, non recoupée : à vérifier avant toute conclusion.
- **Mises à jour de la norme EN 301 549** : la fiche DGCCRF cite la V3.2.1 (2021-06) et WCAG 2.1 `[L1]` ; une version alignée sur WCAG 2.2 n'a pas été vérifiée. La fiche écrit « RGAA v4.2.1 » : la version en vigueur est la 4.1.2 `[L5]`.
- **Seuils et montants** : relire `[L1]`, `[L2]` et `[L4]` avant toute communication externe.
