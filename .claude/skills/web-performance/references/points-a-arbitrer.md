# Points à arbitrer (décision du propriétaire)

Chaque point : ce que dit la règle actuelle, ce que montrent les sources ou les mesures, l'option
recommandée et son coût. Ne pas trancher dans le code sans accord.

## A. « Images : WebP first, AVIF fallback — JAMAIS AVIF en premier » (CLAUDE.md)

- Règle : `formats: ["image/webp", "image/avif"]` est censé servir WebP en premier.
- Constat : la doc Next 14 dit que l'ordre compte (N1), mais le code installé (14.2.35, I4)
  renvoie AVIF à tout navigateur qui l'annonce dans `Accept`, quel que soit l'ordre. Le guide de
  Vercel décrit le même comportement pour son propre optimiseur : avec les deux formats, les
  navigateurs qui acceptent AVIF reçoivent de l'AVIF, et chaque image coûte deux transformations
  et deux entrées de cache (V3). La règle « WebP d'abord » n'est donc pas appliquée par la
  configuration actuelle. Reste à le constater sur notre production.
- Même constat dans le skill `vercel-cost-performance` (point D) : un seul arbitrage pour les deux.
- Vérification (5 min) : en production, `curl -sI -H 'Accept: image/avif,image/webp,*/*' '<URL /_next/image d'une carte boutique>'` et lire `content-type`.
- Options : (1) si l'intention est « jamais AVIF », écrire `formats: ["image/webp"]` (la seule
  configuration qui le garantit ; c'est aussi la valeur par défaut de Next et ce que Vercel
  conseille quand le coût prime, V3) ; (2) accepter AVIF (≈ 20 % plus léger, ≈ 20 % plus long à
  encoder la 1re fois, N1) et corriger CLAUDE.md. Recommandation : (1), cohérent avec
  l'intention écrite et le coût de transformation.

## B. « Preconnect : Clerk + Google Fonts dans layout.tsx » (CLAUDE.md)

- Constat : `next/font/google` auto-héberge les polices, le navigateur n'appelle pas Google (N4).
  Les deux `preconnect` Google ouvrent des connexions qui ne servent jamais.
- Recommandation : retirer les deux `preconnect` Google, garder Clerk ; mettre à jour CLAUDE.md
  § « Performance (PageSpeed) ». Gain faible mais nul risque. Le `preconnect` Clerk vise
  `clerk.klikandgo.app` : il ne sert que si la clé publiable de production pointe bien sur ce
  domaine (à confirmer avec le skill `clerk-auth`). La CSP `fonts.googleapis.com` peut
  rester tant qu'on n'a pas vérifié qu'aucune autre page n'en dépend (aucune trouvée par `grep`).

## C. Sentry dans le JS de chaque page (80 à 100 KB gzip estimés, I2)

- Constat : SDK + Session Replay chargés pour 100 % des visiteurs, même si
  `NEXT_PUBLIC_SENTRY_DSN` n'est pas défini (l'import est statique, seul `init` est conditionnel ;
  le build local du relevé n'avait pas de DSN et contient bien les deux). Replay seul : 37 KB
  gzip mesurés. Le reste est mêlé au runtime de Next dans un chunk de 118 KB : l'estimation
  haute de 155 KB qui a circulé additionnait les deux chunks entiers et est fausse.
- Options, de la moins à la plus engageante : (1) options `treeshake` de `budget-js.md`, sans perte
  fonctionnelle ; (2) Replay chargé à la demande (E1), à mesurer ; (3) retirer Replay (perte :
  vidéos des sessions en erreur) ; (4) retirer le tracing navigateur (perte : Web Vitals Sentry,
  qui est aujourd'hui la seule source gratuite d'INP/CLS terrain).
- Recommandation : (1) tout de suite, (2) en essai mesuré ; (3) et (4) seulement avec l'accord du
  propriétaire.

## D. Speed Insights gratuit ou Plus

- Constat : le gratuit ne donne que le Real Experience Score, 10 000 événements / 30 jours pour
  toute l'équipe, puis coupure ≥ 14 jours (V2). Pas d'INP ni de CLS par route sans Plus
  (10 $ / mois / projet + événements).
- Recommandation : rester gratuit tant que le trafic est faible et s'appuyer sur Sentry pour les
  métriques détaillées — à condition que `NEXT_PUBLIC_SENTRY_DSN` soit bien défini en production
  (non vérifié ici ; sans lui, il n'existe aujourd'hui **aucune** mesure terrain d'INP ni de CLS) ;
  réévaluer Plus quand CrUX publiera des données (W5) ou au lancement
  commercial dans une ville. Voir aussi `vercel-cost-performance` point H.

## E. `<ClerkProvider>` à la racine charge Clerk sur toutes les pages publiques

- Constat : `clerk.browser.js` est récupéré sur chaque page, y compris les pages SEO anonymes (I8).
  Poids non mesuré. S'y ajoutent ≈ 30 à 39 KB gzip de code Clerk dans notre propre bundle, via
  le layout racine (I13).
- Ne rien changer sans le skill `clerk-auth` : CLAUDE.md interdit la prop `dynamic` et les
  composants utilisent `useAuth()` partout. Première étape : mesurer le poids et le temps
  d'exécution sur `/boucherie-halal/chambery` en navigation privée.

## F. Vercel Web Analytics chargé sans consentement, Plausible avec

- Hors du périmètre performance (skill `conformite-france`), signalé parce que les deux scripts
  sont dans `src/app/layout.tsx`. La CSP bloque aussi Plausible (I9).
