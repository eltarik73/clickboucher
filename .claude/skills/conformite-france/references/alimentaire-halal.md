# Information alimentaire, origine, halal — détail

Pas un avis juridique. Le **vendeur** des denrées est la boucherie : c'est elle qui répond de
l'information. Klik&Go fournit les champs pour la donner, n'affirme rien à sa place et ne remplit
jamais une valeur par défaut qui ressemble à une déclaration. Identifiants → [sources.md](sources.md).

## 1. Allergènes (vente à distance de denrées non préemballées)

Règlement INCO 1169/2011, art. 14 § 2 et art. 44 : pour une denrée non préemballée proposée à
distance, les **allergènes** doivent être disponibles **avant la conclusion de l'achat** et à la
remise, sans coût supplémentaire, plus les mentions qu'un État membre impose `[A2]`. En boutique, le
décret 2015-447 demande une information écrite, sur la denrée ou à proximité, sans incertitude ; il
ne traite pas la vente à distance `[L13]`. Pour une barquette **préemballée**, toutes les mentions
obligatoires sont dues avant l'achat, sauf la date `[A2]`.

Les 14 familles de l'annexe II `[A2]` (libellés officiels français et exceptions à reprendre de la
version consolidée) : céréales contenant du gluten, crustacés, œufs, poissons, arachides, soja, lait
(dont lactose), fruits à coque, céleri, moutarde, graines de sésame, anhydride sulfureux et sulfites
(plus de 10 mg/kg ou 10 mg/l), lupin, mollusques.

Viande crue nature : en général sans allergène ; les **préparations** (merguez, saucisses, marinades,
kefta, panés, farces) en contiennent souvent. Le code n'a aucun champ allergène (`Product`,
`ReferenceProduct`).

À faire (migration avec `prisma-expert`) :
- champ structuré (liste fermée des 14 familles) sur `Product` et `ReferenceProduct` — **pas** de
  texte libre seul ;
- trois états distincts : non renseigné, « aucun allergène » déclaré par le boucher, liste ;
- une préparation non renseignée affiche « Allergènes : demandez à votre boucher » et le boucher est
  relancé ; ne jamais afficher « sans allergène » par défaut ;
- affichage dans `ProductSheet` et `WeightSheet` **avant** l'ajout au panier, et sur le ticket
  (`src/components/boucher/OrderTicket.tsx`) pour la remise.

## 2. Origine des viandes

Ce qui est établi par les textes lus :
- **bœuf et veau** : l'étiquetage obligatoire porte le pays de naissance, d'engraissement et
  d'abattage (ou « Origine : pays » si les trois coïncident), avec un numéro de référence ; pour la
  viande non préemballée, cette information est donnée par écrit et de façon visible au point de
  vente `[A3]` ;
- **porc, ovin, caprin, volaille** : pays d'élevage et d'abattage sur l'étiquette des viandes
  fraîches, réfrigérées ou congelées `[A4]` ;
- le décret 2002-1465 modifié concerne la **restauration**, pas la boucherie `[L14]`.

Non tranché : l'obligation d'afficher ces mentions sur une **fiche en ligne** pour de la viande non
préemballée, et le régime national des viandes non bovines vendues à la coupe → **[JURISTE]**.

Règle d'ingénierie, indépendante du point juridique : une origine affichée est une **allégation** ;
fausse, elle contredit l'étiquetage de la boutique et trompe le client. Or `Product.origin` et
`Shop.defaultOrigin` valent `FRANCE` par défaut, et `ProductSheet.tsx` affiche drapeau + origine dès
que le champ est rempli : un boucher qui ne saisit rien « déclare » une origine française.
- Rendre l'origine nullable, sans défaut ; n'afficher que ce que le boucher a saisi ;
- l'enum `Origin` mélange pays, `EU` et `AUTRE` : « AUTRE » n'est pas une information → ne pas
  l'afficher ; pour le bœuf, le texte lu vise des pays, pas une zone `[A3]` ;
- `originRegion`, `race`, `elevageMode` : affichés tels que saisis, attribués au boucher.

## 3. Halal et certification

Ce qui est établi :
- « halal » est une mention à caractère strictement religieux, définie par les seules instances
  religieuses ; l'État ne fixe pas de référentiel, mais ces produits subissent les mêmes contrôles
  que les autres `[Q1]` ;
- afficher un certificat ou un label sans l'autorisation nécessaire est réputé trompeur (L121-4 2°),
  comme affirmer qu'un professionnel est agréé alors qu'il ne l'est pas (4°) `[L9][Q1]`.

Champs existants : `Shop.defaultHalalOrg`, `Shop.halalCertUrl`, `Product.halalOrg`,
`Product.halalMethod` (texte libre). Aujourd'hui `ProductSheet.tsx` affiche « Halal » suivi de
`halalOrg` dès que le texte existe, sans contrôle. Règles :
1. Nom d'organisme affiché **uniquement** si la boutique a déposé un certificat (fichier dans Vercel
   Blob), avec date de validité, vérifié par un admin (« vérifié le / par ») ; sinon
   « Halal (déclaration du boucher) » ou rien.
2. Certificat expiré → le nom de l'organisme cesse de s'afficher (condition calculée à la lecture ou
   cron, cf. `background-jobs-notifications`) et le boucher est relancé.
3. Pas de logo d'organisme sans son autorisation écrite.
4. `halalMethod` (ex. « sans étourdissement ») : présenté comme déclaration du boucher, jamais comme
   garantie de Klik&Go.
5. Klik&Go n'écrit pas « toutes nos boucheries sont certifiées » ni « viandes d'éleveurs français »
   de façon générale. Occurrences actuelles — pages SEO de l'owner, à **arbitrer** et non à modifier
   d'office (SKILL.md, point à arbitrer n° 4). Les retrouver :
   `grep -rniE "halal certifi|certifiées? halal|halal certified|éleveurs français" src/app src/lib`.
   Principales : `src/app/produits/[produit]/[ville]/page.tsx` (« Toutes les boucheries partenaires
   Klik&Go sont halal certifiées »), `src/app/occasions/[occasion]/[ville]/page.tsx`,
   `src/app/boucheries-halal/[departement]/page.tsx`, `src/app/(client)/a-propos/page.tsx`
   (« 100% halal certifié »), `src/lib/seo/*.ts`, le prompt de `src/app/api/chat/route.ts`, et les
   prompts d'image `src/lib/image-prompts.ts` et
   `src/app/api/boucher/images/enhance-prompt/route.ts` (ajoutent « halal certified » à toute image).
6. Images générées par IA présentées comme photos du produit vendu : le signaler au client, sinon
   l'image trompe sur les caractéristiques — à arbitrer avec `seo-anti-penalty`.

## 4. Fraîcheur, poids, préparation

- `Product.freshness` vaut `FRAIS` par défaut et `ProductSheet.tsx` affiche alors le badge « Frais » :
  comme pour l'origine, une valeur par défaut devient une déclaration. La rendre explicite à la saisie.
- Le consommateur doit savoir qu'un produit a été décongelé (INCO, considérant 28 `[A2]`) ; mentions
  exactes pour le non préemballé : **[JURISTE]**.
- Prix au poids : prix TTC + unité (« /kg ») et estimation du total ; voir
  [conso-marketplace.md § 7](conso-marketplace.md).
