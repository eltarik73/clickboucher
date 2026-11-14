# Facturation électronique et accessibilité

Pas un avis juridique ni fiscal. Identifiants → [sources.md](sources.md).

## 1. Facturation électronique (réforme effective depuis le 1er septembre 2026)

Calendrier `[F1]` :

| Date | Obligation |
|---|---|
| Depuis le 1/09/2026 | **Toutes** les entreprises doivent pouvoir **recevoir** des factures électroniques, par une plateforme agréée (PA) qu'elles ont choisie |
| Depuis le 1/09/2026 | Grandes entreprises et ETI : **émission** |
| Au plus tard le 1/09/2027 | PME et microentreprises : **émission**, par une PA, vers les professionnels établis en France |

L'e-reporting (ventes aux particuliers, opérations internationales) suit ce calendrier par taille
selon le ministère (extrait non relu) : à confirmer avec le comptable.

Ce que cela change pour Klik&Go :
- **Commission facturée aux boucheries** (entre professionnels établis en France) : facture
  électronique par une PA au plus tard le 1/09/2027 (Klik&Go est une microentreprise). Ne pas
  construire de générateur PDF « maison » destiné à durer : prévoir la transmission à une PA dans un
  format structuré. Choix de la PA et régime de TVA : **comptable / [JURISTE]**.
- **Réception** : Klik&Go doit déjà avoir choisi une PA pour recevoir les factures de ses
  fournisseurs français (action owner, pas de code).
- **Ventes de viande aux particuliers** : faites par la boucherie, pas par Klik&Go. Le reçu envoyé
  au retrait (`src/lib/emails/order-receipt.ts`, calcul dans `src/lib/pricing/receipt.ts`) n'est pas
  une facture électronique au sens de la réforme : ne pas l'appeler « facture ».
- **Clients PRO** (`CLIENT_PRO`, SIRET) : une vente boucherie → restaurant est entre professionnels ;
  la boucherie devra émettre une facture électronique à son échéance. Si Klik&Go propose un jour de
  générer ces factures pour le compte des boucheries (mandat de facturation), c'est un chantier
  fiscal à part **[JURISTE]**.
- Conservation : documents comptables et pièces justificatives dix ans `[K1]`, en archive et non
  en base active `[C4]`.

## 2. Accessibilité (statut légal seulement)

Le cadre complet (deux régimes, référentiels, sanctions) est dans
`accessibility-wcag/references/cadre-legal-france.md` ; les critères techniques dans
`accessibility-wcag`. Ici, ce qui décide si l'obligation s'applique `[A1]` :
- les exigences issues de la directive européenne visent le **commerce électronique**, pour les
  services fournis après le 28/06/2025 ; la DGCCRF contrôle ;
- selon la fiche DGCCRF, pour une entreprise de moins de 10 salariés dont le chiffre d'affaires ou
  le total de bilan est inférieur à 2 M€, aucune obligation d'accessibilité ne s'impose aux
  prestataires de services. Klik&Go est vraisemblablement dans ce cas, les boucheries aussi :
  **[JURISTE]** pour le confirmer, et à réévaluer à chaque embauche ou hausse du chiffre d'affaires ;
- au-dessus du seuil : expliquer dans les conditions générales, ou un document équivalent, comment
  le service satisfait aux exigences, tant qu'il est proposé (D412-57 2° et son annexe) ;
- exemption ne veut pas dire permission de régresser : CLAUDE.md impose cibles tactiles ≥ 44 px et
  mode sombre, et `accessibility-wcag` fixe le niveau visé par le projet.
