# Sauvegardes et restauration PostgreSQL (Railway)

Contexte : base PostgreSQL sur Railway (hôte `switchyard.proxy.rlwy.net`), schéma Prisma, migrations
par `prisma migrate deploy` (CLAUDE.md). Les actions sur Railway et le stockage externe sont
faites par le propriétaire ; l'agent prépare les commandes et vérifie, sans jamais lire un fichier
d'environnement ni toucher à la base de production.

## 1. Ce que Railway fournit (doc lue le 2026-11-14)

| Mécanisme | Ce qu'il fait | Limites |
| --- | --- | --- |
| Sauvegardes de volume [S14] | manuelles ou planifiées : quotidienne (gardée 6 j), hebdomadaire (27 j), mensuelle (89 j) ; incrémentales | restaurées dans le **même projet et environnement** ; **vider le volume supprime ses sauvegardes** ; sauvegarde manuelle limitée à 50 % de la taille du volume ; fonction décrite comme encore en développement |
| PITR [S15] | archivage continu des WAL (pgBackRest) vers un bucket Railway ; 4 sauvegardes complètes gardées (≈ 4 semaines) ; pas de frais propres, on paie le stockage du bucket et le trafic d'envoi | **non rétroactif** (fenêtre à partir de la 1re sauvegarde de base après activation) ; restaure dans un **nouveau service** `<source>-restored-AAAAMMJJ-HHMM`, qui **n'archive plus** ; bascule manuelle ; image Postgres à garder sur un tag majeur (`postgres-ssl:16`, pas `16.10`) ; en cas de panne longue du stockage, des WAL sont abandonnés et la fenêtre raccourcit |

La disponibilité selon le plan n'est écrite dans aucune des deux pages (non vérifié) : regarder
l'onglet *Backups* du service. La page PITR ne chiffre pas la granularité pour PostgreSQL
(« n'importe quel instant de la fenêtre »).

`audit/db-runbook.md` § 3 (« PITR sur Pro+, granularité ~5 min », « Restore crée une nouvelle DB »)
ne correspond pas à ces pages : la bascule passe par un nouveau service et une mise à jour de
`DATABASE_URL` et `DIRECT_DATABASE_URL` sur Vercel, puis un redéploiement. Le reste de ce document
est périmé aussi (`prisma-expert`, point A3) : ne pas en suivre les commandes.

## 2. Politique cible

| Couche | Fréquence | Rétention | Où | Protège contre |
| --- | --- | --- | --- | --- |
| PITR Railway | continu | ≈ 4 semaines | Railway | erreur humaine (UPDATE sans WHERE, migration fautive) |
| Sauvegarde de volume Railway | quotidienne + hebdomadaire | 6 j / 27 j | Railway | panne de volume |
| `pg_dump -Fc` chiffré | quotidienne | 30 j + 12 mensuelles | **hors Railway** (stockage objet d'un autre fournisseur) | perte du projet ou du compte Railway, incident de sécurité chez Railway |

Cibles (proposition de ce skill, à valider par le propriétaire) : **RPO** de quelques minutes avec
PITR — non chiffré par Railway, à mesurer pendant l'exercice — et ≤ 24 h avec le seul dump
quotidien ; **RTO** ≤ 1 h. Les rétentions de la troisième ligne sont aussi une proposition.

## 3. Dump hors plateforme

```bash
# Client pg_dump de la même version majeure que le serveur, ou plus récente : pg_dump refuse un serveur plus récent que lui [S21]
pg_dump --format=custom --no-owner --no-privileges \
  --file="klikgo-$(date -u +%Y%m%dT%H%MZ).dump" "$DIRECT_DATABASE_URL"
```

- `-Fc` : compressé, lisible par `pg_restore`, restauration sélective possible ; dump cohérent
  sans bloquer lecteurs ni écrivains [S21].
- Utiliser `DIRECT_DATABASE_URL` (connexion non poolée, CLAUDE.md), pas l'URL poolée.
- Relever la version du serveur (`SHOW server_version;`) : elle fixe celle du client et celle du
  conteneur de restauration — recharger un dump dans un serveur plus ancien n'est pas garanti [S21].
- Chiffrer avant envoi (clé gardée hors du fournisseur de stockage). Le dump contient des données
  personnelles (clients, téléphones) : accès restreint, durée de conservation documentée
  (`conformite-france`).
- Où le lancer : un planificateur **hors Vercel** (le site ne doit pas dépendre de la plateforme
  surveillée — leçon de novembre) et pas seulement dans Railway (c'est la base). Choix de
  l'hébergeur : point à arbitrer G.

## 4. Exercice de restauration (trimestriel, chronométré)

Jamais sur la production. Base jetable locale dans Docker (seul outil PostgreSQL installé sur le
poste : ni `psql` ni `pg_restore` en local, on passe par le conteneur). Les drapeaux ci-dessous
ont été rejoués par le vérificateur le 2026-11-14 sur un conteneur jetable (dump puis restauration
d'une table de test, PostgreSQL 15).

1. Récupérer le dump le plus récent (ou créer une restauration PITR à « maintenant − 1 h » dans
   un service Railway séparé, puis le dumper) — propriétaire.
2. Conteneur de la **même version majeure** que la production, sur un port libre, lié à la boucle
   locale :
   `docker run --rm -d --name klikgo-restore -e POSTGRES_PASSWORD=<mdp> -p 127.0.0.1:55499:5432 postgres:<majeure>`
3. Copier puis restaurer dans le conteneur :
   `docker cp klikgo-AAAAMMJJ.dump klikgo-restore:/tmp/k.dump`
   `docker exec klikgo-restore pg_restore --no-owner --no-privileges --exit-on-error --dbname="postgresql://postgres:<mdp>@127.0.0.1:5432/postgres" /tmp/k.dump`
4. Contrôles :
   - `npx prisma migrate status` avec `DATABASE_URL` **et** `DIRECT_DATABASE_URL` posées sur la
     même ligne de commande et visant `127.0.0.1:55499` : le schéma déclare un `directUrl`, et la
     CLI lit les fichiers d'environnement du dépôt pour toute variable absente — oublier la
     seconde, c'est interroger une autre base. Lire l'hôte affiché par la CLI avant de conclure.
     Attendu : aucune migration en attente ni inconnue.
   - Comptages comparés au tableau Railway : `SELECT count(*) FROM orders;`, `shops`, `users`
     (`docker exec klikgo-restore psql -U postgres -c "…"`).
   - Dernière commande : `SELECT max(created_at) FROM orders;` → écart avec l'heure du dump = RPO réel.
5. Noter dans le journal d'exercices : date, durée totale (= RTO réel hors bascule), RPO mesuré,
   problèmes. `docker stop klikgo-restore` (le conteneur `--rm` disparaît) et supprimer le fichier
   de dump local.

Une restauration qui n'a jamais été testée n'est pas comptée comme sauvegarde.

## 5. Bascule après une vraie perte (rappel pour le runbook)

1. Geler les écritures : mettre les boutiques en pause (ou couper les crons) pour ne pas écrire
   dans la base qu'on va remplacer.
2. PITR vers l'instant juste avant l'incident → nouveau service [S15].
3. Contrôles du § 4 sur le nouveau service.
4. Mettre à jour `DATABASE_URL` (poolée) et `DIRECT_DATABASE_URL` sur Vercel Production, puis
   **redéployer** : un déploiement garde les variables lues à sa construction [S27].
5. `/api/health` 200, puis une lecture réelle (page boutique, tableau cuisine). Pas de commande
   de test en production : le mode test n'y existe pas (CLAUDE.md).
6. **Réactiver PITR sur le nouveau service** : le service restauré n'archive pas [S15]. Tant que
   ce n'est pas fait, il n'y a plus de filet.
7. Garder l'ancien service intact jusqu'au post-mortem (preuves), puis le supprimer. Les variables
   du service restauré donnent un accès en écriture à l'archive du service source [S15] : en
   restreindre l'accès.
