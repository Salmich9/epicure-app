# LOGIQUES.md — Logiques de calcul d'Epicure

> Ce fichier explique en français simple toutes les règles de calcul
> utilisées par l'application. À mettre à jour après chaque session de développement.
> Dernière mise à jour : 2026-06-14

---

## 1. Valeur totale du stock (page Dépôt)

**Description :** Pour chaque article présent au dépôt, on multiplie la quantité disponible par son coût moyen pondéré. On additionne tous les articles actifs pour obtenir la valeur totale affichée en haut de la page Dépôt.

**Formule :** Quantité en stock × Coût moyen pondéré = Valeur de l'article → Addition de tous les articles actifs = Valeur totale du dépôt

**Fichier :** `src/pages/Depot.jsx`

**Calcul situé à la ligne :** ~146

**Variables depuis les Réglages :** non

**Modifiable sans code :** non — le coût moyen se recalcule automatiquement à chaque achat enregistré

**Risque de modification :** élevé

**Pourquoi ce risque :** Changer la base de calcul (par exemple utiliser un autre prix que le coût moyen) fausserait toute la valorisation du stock.

**Dépend de :** Logique n°2 (coût moyen pondéré)

---

## 2. Coût moyen pondéré (CMP)

**Description :** Chaque fois qu'un achat est enregistré, l'application recalcule automatiquement le prix moyen unitaire de l'article, en tenant compte du stock déjà en place et du nouveau lot reçu.

**Formule :** (Quantité en stock avant achat × Prix moyen actuel + Quantité achetée × Prix d'achat) ÷ (Quantité en stock avant + Quantité achetée) = Nouveau prix moyen

**Exemple :** 200 cloches à 25 DH en stock. Achat de 100 cloches à 18 DH. Nouveau prix moyen = (200 × 25 + 100 × 18) ÷ 300 = 22,67 DH

**Fichier :** `src/data/purchases.js` (déclenchement) + calcul effectué automatiquement par la base de données

**Calcul situé à la ligne :** ~73 dans `purchases.js`

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** élevé

**Pourquoi ce risque :** Une erreur dans cette formule fausse la valorisation de tout le stock pour les articles concernés.

**Dépend de :** l'historique des mouvements de stock et du prix moyen précédent de l'article

---

## 3. Valeur totale en cours de saisie (page Inventaire)

**Description :** Pendant qu'on saisit un inventaire, l'application calcule en temps réel la valeur totale de ce qu'on est en train de compter, article par article, et l'affiche en bas de page.

**Formule :** Addition de (Quantité saisie × Dernier prix d'achat) pour chaque article = Total affiché en cours de saisie

**Fichier :** `src/pages/Inventaire.jsx`

**Calcul situé à la ligne :** ~185

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** modéré

**Pourquoi ce risque :** Ce calcul utilise le dernier prix d'achat (pas le coût moyen) — c'est intentionnel pour l'inventaire, mais à ne pas confondre avec la valorisation du dépôt.

**Dépend de :** le dernier prix d'achat de chaque article

---

## 4. Détection des articles en alerte stock

**Description :** L'application compare en permanence la quantité disponible de chaque article avec le seuil d'alerte que tu as défini dans le catalogue. Si la quantité est inférieure ou égale au seuil, l'article apparaît en alerte (page Dépôt, tableau de bord).

**Formule :** Quantité disponible ≤ Seuil d'alerte défini pour l'article → Article affiché en alerte

**Fichier :** `src/data/dashboard.js`

**Calcul situé à la ligne :** ~33

**Variables depuis les Réglages :** non — le seuil est défini article par article dans le Catalogue

**Modifiable sans code :** oui — en modifiant le "Seuil d'alerte stock" directement dans la fiche article du Catalogue

**Risque de modification :** faible

**Pourquoi ce risque :** Ne touche qu'à l'affichage des alertes, pas au stock réel.

**Dépend de :** le seuil d'alerte défini pour chaque article

---

## 5. Couleur du KPI "Écarts du mois" (tableau de bord)

**Description :** Le carré "Écarts du mois" sur le tableau de bord change de couleur selon la gravité des pertes constatées ce mois-ci.

**Formule :**
- Aucun écart → vert
- Écart présent mais en dessous du seuil configuré → orange
- Écart supérieur ou égal au seuil configuré → rouge

**Fichier :** `src/pages/Dashboard.jsx`

**Calcul situé à la ligne :** ~162

**Variables depuis les Réglages :** **oui** — `seuil_ecart_valeur` (valeur par défaut : 500 MAD)

**Modifiable sans code :** **oui** — via Paramètres → Réglages → "Seuil valeur écart"

**Risque de modification :** faible

**Pourquoi ce risque :** Ne touche qu'à la couleur affichée, pas au calcul des écarts lui-même.

**Dépend de :** Logique n°6 (calcul du montant des écarts)

---

## 6. Calcul du total des écarts du mois (tableau de bord)

**Description :** Chaque mois, la base de données additionne la valeur de tous les articles perdus ou non retournés lors des événements clôturés. C'est ce montant qui s'affiche dans le KPI "Écarts du mois".

**Formule :** calculé directement par la base de données — non recalculé par l'application

**Fichier :** `src/data/dashboard.js` (l'application demande le résultat à la base de données)

**Calcul situé à la ligne :** ~4

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** élevé

**Pourquoi ce risque :** Ce calcul est fait dans la base de données — toute modification nécessite une intervention technique et impacte directement le tableau de bord.

**Dépend de :** les mouvements de stock de type "perte" enregistrés lors des clôtures d'événements, Logique n°5 (couleur du KPI)

---

## 7. Valeur totale prélevée (bon de prélèvement imprimable)

**Description :** Sur le bon de prélèvement imprimable, chaque article prélevé est valorisé avec son dernier prix d'achat connu. La somme de tous ces montants donne la valeur totale prélevée pour l'événement.

**Formule :** Addition de (Quantité prélevée × Dernier prix d'achat) pour chaque article = Valeur totale prélevée

**Note importante :** Ce calcul utilise le dernier prix d'achat — pas le coût moyen pondéré. C'est intentionnel : on s'en sert pour estimer le budget de l'événement, pas pour valoriser le stock du dépôt.

**Fichier :** `src/pages/Evenements.jsx` — section "Bon de prélèvement"

**Calcul situé à la ligne :** ~55

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** modéré

**Pourquoi ce risque :** Changer la base de prix (ex. utiliser le coût moyen) modifierait les montants affichés sur tous les bons imprimés.

**Dépend de :** le dernier prix d'achat de chaque article

---

## 8. Valeur totale des prélèvements en cours (détail événement)

**Description :** Dans la fiche d'un événement en cours, l'application affiche la valeur financière totale de tout ce qui a déjà été sorti du dépôt pour cet événement.

**Formule :** Addition de (Quantité totale prélevée par article × Dernier prix d'achat) = Valeur totale prélevée affichée dans la fiche événement

**Fichier :** `src/pages/Evenements.jsx` — section détail événement

**Calcul situé à la ligne :** ~607

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** faible

**Pourquoi ce risque :** Affichage uniquement, ne modifie pas le stock.

**Dépend de :** Logique n°7 (même base de calcul), dernier prix d'achat de chaque article

---

## 9. Calcul des écarts par article (saisie des retours)

**Description :** Lors de la saisie des retours d'un événement, pour chaque article, l'application compare ce qui est sorti du dépôt avec ce qui est revenu. La différence est l'écart. Si tout est revenu (ou plus), l'écart est zéro — jamais négatif.

**Formule :** Quantité prélevée − Quantité retournée = Écart (minimum 0)

**Fichier :** `src/pages/Evenements.jsx` — section retours

**Calcul situé à la ligne :** ~425

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** modéré

**Pourquoi ce risque :** Un écart mal calculé génère un enregistrement de perte incorrect dans l'historique du stock et fausse les statistiques du mois.

**Dépend de :** Logique n°10 (conversion de l'écart en valeur financière)

---

## 10. Valeur financière des écarts (bon de retour)

**Description :** Les écarts en quantité (articles manquants) sont convertis en valeur financière pour le bon de retour et le récapitulatif. On utilise le dernier prix d'achat de chaque article.

**Formule :** Addition de (Écart en quantité × Dernier prix d'achat) pour chaque article = Valeur totale des écarts

**Note importante :** Si le prix d'achat d'un article change après la clôture d'un événement, la valeur affichée sur les anciens bons de retour n'est pas recalculée rétroactivement.

**Fichier :** `src/pages/Evenements.jsx` — sections retours et bon de retour

**Calcul situé à la ligne :** ~434 (saisie retours) et ~139 (bon imprimable)

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** modéré

**Pourquoi ce risque :** Changer la base de prix modifierait tous les montants affichés sur les bons de retour.

**Dépend de :** Logique n°9 (écart en quantité), dernier prix d'achat de chaque article

---

## 11. Durée avant rechargement automatique du tableau de bord

**Description :** Le tableau de bord ne se reconnecte pas à la base de données à chaque seconde. Il garde les données en mémoire pendant un certain nombre de secondes avant de les actualiser automatiquement. Cette durée est configurable dans les Réglages.

**Formule :** Valeur configurée (en secondes) × 1 000 = durée réelle de mise en mémoire (format interne de l'application)

**Fichier :** `src/pages/Dashboard.jsx`

**Calcul situé à la ligne :** ~77

**Variables depuis les Réglages :** **oui** — `dashboard_cache_ttl` (valeur par défaut : 120 secondes, soit 2 minutes)

**Modifiable sans code :** **oui** — via Paramètres → Réglages → "Durée du cache Dashboard"

**Risque de modification :** faible

**Pourquoi ce risque :** Une valeur trop courte ralentit l'application (trop de connexions à la base de données). Une valeur trop longue affiche des données en retard.

---

## 12. Total affiché lors de la saisie d'un achat

**Description :** Dans le formulaire de création d'un achat, l'application affiche en temps réel le montant total pour que tu puisses vérifier avant d'enregistrer.

**Formule :** Quantité saisie × Prix unitaire saisi = Total affiché

**Note :** Ce total affiché est aussi recalculé par la base de données au moment de l'enregistrement. Les deux calculs sont identiques.

**Fichier :** `src/pages/Achats.jsx`

**Calcul situé à la ligne :** ~191

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** faible

**Pourquoi ce risque :** Affichage uniquement pendant la saisie — l'enregistrement réel est fait par la base de données.

---

## 13. Valeur par catégorie (page Dépôt)

**Description :** Dans la page Dépôt, chaque catégorie d'articles affiche la somme de la valeur de tous ses articles.

**Formule :** Addition des valeurs de stock de tous les articles d'une même catégorie = Valeur affichée pour la catégorie

**Fichier :** `src/pages/Depot.jsx`

**Calcul situé à la ligne :** ~195

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** faible

**Pourquoi ce risque :** Sous-total d'affichage uniquement, directement dérivé de la logique n°1.

**Dépend de :** Logique n°1 (valeur totale du stock), Logique n°2 (coût moyen pondéré)

---

## 14. Pré-remplissage automatique d'un inventaire

**Description :** Le bouton ⚡ Pré-remplir copie les quantités actuellement disponibles au dépôt dans les cases vides de l'inventaire en cours. Les cases déjà remplies manuellement ne sont pas modifiées.

**Formule :** Si la case est vide → la remplir avec la quantité actuelle du stock. Si la case est déjà remplie → ne rien toucher.

**Fichier :** `src/pages/Inventaire.jsx`

**Calcul situé à la ligne :** ~139

**Variables depuis les Réglages :** non

**Modifiable sans code :** non

**Risque de modification :** modéré

**Pourquoi ce risque :** Si la protection "ne touche pas les cases déjà remplies" était retirée, toute saisie manuelle faite avant de cliquer sur le bouton serait perdue.

**Dépend de :** les quantités actuelles du dépôt au moment du clic

---

## Résumé — Ce qu'on peut changer sans toucher au code

| Ce qu'on peut régler | Où le changer | Logique concernée |
|---|---|---|
| Seuil de couleur rouge pour les écarts du mois | Paramètres → Réglages → "Seuil valeur écart" | n°5 |
| Durée avant rechargement du tableau de bord | Paramètres → Réglages → "Durée du cache Dashboard" | n°11 |
| Seuil d'alerte stock d'un article | Catalogue → fiche article → "Seuil d'alerte stock" | n°4 |

Tout le reste nécessite une modification du code ou de la base de données.
