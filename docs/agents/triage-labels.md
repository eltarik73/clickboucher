# États de tri

Les compétences parlent de cinq rôles de tri. Dans le suivi local (`.scratch/`, voir
`issue-tracker.md`), chaque rôle s'écrit tel quel sur la ligne `Status:` du ticket.

| Rôle | Valeur dans nos tickets | Sens |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | À évaluer par le propriétaire ou le directeur du programme |
| `needs-info` | `needs-info` | En attente d'une information |
| `ready-for-agent` | `ready-for-agent` | Entièrement spécifié, un agent peut le traiter seul |
| `ready-for-human` | `ready-for-human` | Demande une action ou une décision humaine (compte tiers, texte légal, prix…) |
| `wontfix` | `wontfix` | Ne sera pas traité |

Les décisions réservées au propriétaire (indexation, textes légaux, prix et commissions, dépublication
d'une boutique, service payant) sont toujours `ready-for-human`.
