# Interroger Epicure depuis un bot

Six vues répondent aux questions courantes sans que le bot ait à connaître le
schéma. Elles sont créées par `migrations/026_vues_questions.sql`.

| Vue | Une ligne par | Sert à |
|---|---|---|
| `v_depot_resume` | *(une seule ligne)* | la valeur du dépôt |
| `v_depot` | article actif | « combien j'ai de… » |
| `v_achats` | achat | « qu'a-t-on acheté ce mois-ci » |
| `v_evenements` | événement | écarts et taux de retour |
| `v_evenements_articles` | article × événement | le détail d'un écart |
| `v_mouvements` | mouvement de stock | l'historique brut |

## Les questions, et leur requête

**« Combien vaut mon dépôt ? »**

```sql
select valeur_totale, articles_en_stock, date_inventaire, inventaire_jours
from v_depot_resume;
```

→ `34915.00 MAD · 19 articles · inventaire du 2026-08-12 (25 j)`

**Réponds toujours avec la date d'inventaire.** Un chiffre de vingt-cinq jours
ne se lit pas comme un chiffre d'hier, et l'omettre revient à mentir par
raccourci. La vue la fournit pour que le bot n'ait pas d'excuse.

**« Combien j'ai de verres Old Fashioned ? »**

```sql
select article, quantite, unite, valeur, date_inventaire
from v_depot
where article ilike '%old fashioned%';
```

Utiliser `ilike '%…%'` et non l'égalité : les noms d'articles sont saisis à la
main, avec des majuscules et des espaces incohérents.

**« Qu'avons-nous acheté ce mois-ci ? »**

```sql
select article, fournisseur, quantite, total
from v_achats
where mois = to_char(current_date, 'YYYY-MM')
order by date_achat desc;
```

La colonne `mois` est déjà au format `AAAA-MM`, prête à comparer.

**« Combien de casses au dernier événement ? »**

```sql
select evenement, date_evenement, preleve, retourne, ecart, valeur_ecart, taux_retour_pct
from v_evenements
where preleve > 0
order by date_evenement desc
limit 1;
```

Le détail, article par article :

```sql
select article, preleve, retourne, ecart, valeur_ecart
from v_evenements_articles
where event_id = $1 and ecart <> 0
order by valeur_ecart desc;
```

## Ce que « écart » veut dire ici

L'écart est la différence entre ce qui est sorti et ce qui est revenu. C'est la
mesure de la casse et des pertes.

Il n'existe **aucun mouvement de type `perte`** dans ce schéma, et c'est
délibéré : `validate_event_returns` déduit déjà l'écart de la différence
prélèvement/retour. En ajouter un compterait deux fois.

`v_evenements.ecart` ne compte que les articles **retournables**. Un consommable
qui ne revient pas n'est pas une casse — c'est sa destination. `v_evenements_articles`,
lui, montre les deux natures, à charge de filtrer.

## Valorisation

Tout est valorisé au **coût moyen pondéré** (`articles.average_cost`), comme
`current_stock` et comme l'app.

⚠️ Une exception connue : `get_dashboard_stats()` valorise les écarts au
**dernier prix d'achat**. Le dashboard et le bot donneront donc des montants
différents pour le même écart. Incohérence laissée telle quelle — la corriger
changerait des chiffres déjà affichés.

## Accès

Les vues héritent des policies de leurs tables sources, toutes permissives pour
`anon` (voir la note dans `024`). Un bot serveur devrait néanmoins utiliser la
clé `service_role` : elle ne dépend pas de policies qui pourraient être
resserrées un jour.

Ces vues sont en **lecture seule**. Pour écrire — un achat, un inventaire, un
prélèvement — il faut passer par l'app ou par les fonctions existantes
(`validate_inventory`, `validate_event_returns`), qui portent les règles.
