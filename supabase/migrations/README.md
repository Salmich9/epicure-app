# Migrations Epicure

## La convention

`NNN_nom.sql` — trois chiffres, séquentiels. La version enregistrée dans
`supabase_migrations.schema_migrations` est **le préfixe du fichier**, pas un
horodatage.

## L'état, remis d'aplomb le 04/09/2026

Jusqu'ici, aucune des migrations `001` à `018` n'était enregistrée. Le registre
ne contenait que des lignes horodatées appartenant à un autre projet.

Conséquence concrète : `supabase db push` lisait les fichiers locaux comme
versions `001`…`023`, n'en trouvait aucune au registre, et **tentait de tout
réappliquer** — à commencer par `001_schema.sql` sur une base qui a déjà ces
tables. La commande échouait, potentiellement à mi-parcours.

Les 22 versions sont désormais enregistrées comme appliquées. Le registre
reflète exactement les fichiers de ce répertoire.

## La règle, à partir de maintenant

**Une migration = un fichier ici + une ligne au registre.** Les deux, toujours.

En particulier : appliquer du DDL depuis l'éditeur SQL de Supabase, ou via un
outil qui écrit directement en base, crée une ligne horodatée qui ne correspond
à aucun fichier — c'est exactement ce qui a produit la dérive. Si tu le fais
quand même, ajoute le fichier ensuite et corrige la version.

## Deux anomalies connues, laissées telles quelles

**Il n'y a pas de `019`.** Un `019_event_billing_lines.sql` était prévu pour
sortir la facturation stockée dans `event_briefing` sous les clés `fact_bar_*`
avant toute suppression de cette table. Il n'a pas été écrit. Le trou est sans
effet sur l'outillage, mais le besoin, lui, reste entier : ces données de
facturation n'existent nulle part ailleurs dans le schéma.

**Neuf lignes horodatées n'ont aucun fichier ici.** Elles enregistrent les
migrations de `factures_registre` et `dossiers_drive` — le bot de traitement des
factures, un projet distinct qui partage cette base de données. Elles sont
exactes et doivent rester. `supabase migration list` les affichera comme
distantes sans équivalent local ; c'est normal, et c'est le signe que deux
projets écrivent dans la même base.

## Revenir en arrière

Le registre est un journal : le corriger n'a touché aucune table métier.

```sql
delete from supabase_migrations.schema_migrations
 where version ~ '^0[0-9]{2}$';
```
