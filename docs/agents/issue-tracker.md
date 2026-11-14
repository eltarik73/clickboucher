# Suivi des tickets : fichiers Markdown locaux

Les specs et tickets produits par les compétences du paquet `mattpocock-skills` (`/to-spec`,
`/to-tickets`, `/triage`, `/wayfinder`, `/implement`) vivent dans `.scratch/`, à la racine du dépôt.

**`.scratch/` est exclu de git** (`.gitignore`) : le dépôt est public et un ticket peut décrire une
faille pas encore corrigée ou une donnée de production. Ne jamais déplacer un ticket vers un dossier
suivi, ni le recopier dans une issue GitHub publique.

## Conventions

- Un dossier par sujet : `.scratch/<sujet>/`.
- La spec du sujet : `.scratch/<sujet>/spec.md`.
- Un fichier par ticket : `.scratch/<sujet>/issues/<NN>-<slug>.md`, numéroté à partir de `01`.
- L'état de tri est une ligne `Status:` en haut du ticket (valeurs dans `triage-labels.md`).
- Les échanges s'ajoutent en bas du fichier sous un titre `## Comments`.

## « Publier dans le suivi »

Créer le fichier sous `.scratch/<sujet>/` (en créant le dossier au besoin).

## « Lire le ticket »

Lire le fichier au chemin donné ; l'utilisateur fournit le chemin ou le numéro.

## Cartographie (`/wayfinder`)

- Carte : `.scratch/<chantier>/map.md` (notes, décisions prises, zones encore floues).
- Ticket enfant : `.scratch/<chantier>/issues/NN-<slug>.md`, avec une ligne `Type:`
  (`research`, `prototype`, `grilling` ou `task`) et une ligne `Status:` (`claimed` ou `resolved`).
- Blocage : une ligne `Blocked by: NN, NN` ; un ticket est débloqué quand tous ceux qu'il cite sont
  `resolved`.
- Prochain ticket : le premier ouvert, débloqué et non réclamé, par numéro.
- Réclamer : `Status: claimed`, enregistrer, puis travailler.
- Clore : réponse sous `## Answer`, `Status: resolved`, puis une ligne de renvoi dans la section des
  décisions de `map.md`.

## Lien avec le programme

Les chantiers du programme de remise à niveau gardent leur propre circuit (plan, recette, contrôles)
décrit par la compétence `klikgo-programme` ; `.scratch/` sert aux sujets plus petits ou exploratoires.
