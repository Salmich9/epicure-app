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

## Une anomalie connue, laissée telle quelle

**Neuf lignes horodatées n'ont aucun fichier ici.** Elles enregistrent les
migrations de `factures_registre` et `dossiers_drive` — le bot de traitement des
factures, un projet distinct qui partage cette base de données. Elles sont
exactes et doivent rester. `supabase migration list` les affichera comme
distantes sans équivalent local ; c'est normal, et c'est le signe que deux
projets écrivent dans la même base.

## Le domaine « organisation d'événement » a été supprimé

`025_suppression_briefing.sql` retire tout ce qui servait à organiser un
événement : `event_briefing`, `event_billing_lines`, `bot_sessions`,
`stock_reservations`, `bot_users`, `clients`, `venues`, `employees`,
`prestataires`, plus `events.client_id` / `events.venue_id` et les fonctions
`stock_disponible()` / `expirer_reserves_provisoires()`.

Les 92 lignes d'`event_briefing` ont été vérifiées avant suppression : elles
appartenaient toutes au seul événement « Test 8 » du 14/06/2026. Aucune donnée
de production.

L'app documente désormais le stock — achats, catalogue, dépôt, inventaires — et
par événement les prélèvements, retours et écarts.

`026_vues_questions.sql` ajoute six vues de lecture pour un bot. Voir
`../REQUETES-BOT.md`.

Les sections ci-dessous décrivent des migrations désormais annulées par la 025.
Elles sont conservées pour l'historique.

## La facturation, sortie de l'EAV

`019_event_billing_lines.sql` crée `event_billing_lines` et y reprend ce que
`event_briefing` portait en facturation. Deux familles de clés :

    bar_{N}_entite_facturation                              — au niveau du bar
    fact_bar_{N}_{cocktail|shot}_{itemId}_{alcool|garnish}   — par article

Au moment de l'écrire, la base contenait **2 lignes de la première famille et
0 de la seconde** : la section facturation de l'app est du travail en cours,
jamais utilisé. Le backfill des clés `fact_*` est écrit et testé, il ne trouve
simplement rien à reprendre pour l'instant.

`event_briefing` n'est pas touchée : les données y restent en double le temps
que l'app soit basculée sur la nouvelle table.

**Il reste donc une chose à faire côté app** avant de pouvoir supprimer
`event_briefing` : faire écrire `BriefingSection11.jsx` dans
`event_billing_lines` plutôt que dans l'EAV. Tant que ce n'est pas fait, toute
facturation saisie continue d'atterrir dans `event_briefing`.

## Revenir en arrière

Le registre est un journal : le corriger n'a touché aucune table métier.

```sql
delete from supabase_migrations.schema_migrations
 where version ~ '^0[0-9]{2}$';
```
