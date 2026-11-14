# Documentation du domaine

Comment les compétences d'ingénierie lisent le vocabulaire et les décisions de Klik&Go. Le dépôt est
**mono-contexte** : une seule application Next.js.

## À lire avant d'explorer

- **`GLOSSARY.md`** à la racine : le vocabulaire du métier (boutique, commande, créneau de retrait,
  ajustement de prix, anti-gaspi…) et les synonymes à éviter.
- **`docs/adr/`** : les décisions d'architecture qui touchent la zone concernée.
- **`CLAUDE.md`** : les règles non négociables du projet, qui priment sur tout le reste.

Si `GLOSSARY.md` ou `docs/adr/` n'existent pas encore, continuer sans le signaler : `/domain-modeling`
(appelée par `/grill-with-docs` et `/improve-codebase-architecture`) les crée au moment où un terme ou
une décision est tranché.

## Structure

```
/
├── CLAUDE.md
├── GLOSSARY.md
├── docs/adr/
│   └── 0001-<decision>.md
└── src/
```

## Employer le vocabulaire du glossaire

Un concept du métier (dans un titre de ticket, une proposition de refactorisation, un nom de test)
s'écrit avec le terme défini dans `GLOSSARY.md`, jamais avec un synonyme que le glossaire écarte. Un
concept absent du glossaire est un signal : soit le terme est inventé (le revoir), soit il manque
(le noter pour `/domain-modeling`).

## Signaler un conflit avec une décision

Une proposition qui contredit un ADR le dit explicitement, avec la raison de rouvrir la décision,
plutôt que de la contourner en silence. Même règle pour une règle de `CLAUDE.md` : la contredire
demande l'accord du propriétaire.
