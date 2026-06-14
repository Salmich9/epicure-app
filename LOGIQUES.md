# LOGIQUES.md — Logiques de calcul d'Epicure

> Toutes les logiques de calcul codées dans React, documentées en français simple.
> **À mettre à jour après chaque session Claude Code.**
> Dernière mise à jour : 2026-06-14

---

## 1. Valeur totale du stock (Dépôt)

**Description :** Calcule la valeur financière de tout le stock physique présent au dépôt.

**Formule :** Quantité en stock × Coût moyen pondéré = Valeur de l'article → Somme de tous les articles actifs = Valeur totale

**Fichier :** `src/pages/Depot.jsx`

**Fonction :** `useMemo(() => stock.reduce(...))`

**Ligne approximative :** ~146

**Variables depuis app_settings :** non

**Modifiable sans code :** non — le coût moyen pondéré (`average_cost`) est recalculé automatiquement à chaque achat

**Risque modification :** élevé

**Pourquoi ce risque :** Changer la base de calcul (ex. remplacer CMP par dernier prix) fausse toute la valorisation historique du stock.

**Dépend de :** Logique n°2 (CMP), vue SQL `current_stock`

---

## 2. Coût moyen pondéré (CMP)

**Description :** Recalcule le prix unitaire moyen d'un article chaque fois qu'un achat est enregistré, en tenant compte du stock existant et du nouveau lot acheté.

**Formule :** (Stock avant × CMP actuel + Quantité achetée × Prix unitaire achat) ÷ (Stock avant + Quantité achetée) = Nouveau CMP

**Fichier :** `supabase/migrations/013_average_cost.sql` (RPC SQL) + `src/data/purchases.js` (appel)

**Fonction :** RPC `recalculate_average_cost()` appelée dans `createPurchase()`

**Ligne approximative :** `purchases.js` ~73

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** élevé

**Pourquoi ce risque :** Erreur dans cette formule = toute la valorisation du stock est fausse pour tous les articles touchés.

**Dépend de :** table `stock_movements`, colonne `articles.average_cost`

---

## 3. Valeur d'un article dans l'inventaire (total courant)

**Description :** Affiche en temps réel la valeur totale comptée pendant la saisie d'un inventaire, avant validation.

**Formule :** Somme pour chaque article de (Quantité saisie × Prix unitaire) = Total de l'inventaire en cours

**Fichier :** `src/pages/Inventaire.jsx`

**Fonction :** `useMemo(() => articles.reduce(...))` nommé `totalCurrent`

**Ligne approximative :** ~185

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** modéré

**Pourquoi ce risque :** Le prix unitaire utilisé est `last_purchase_price` (pas le CMP) — cohérent pour un inventaire mais à distinguer de la valorisation du dépôt.

**Dépend de :** champ `articles.last_purchase_price`

---

## 4. Détection des articles en alerte stock

**Description :** Identifie les articles dont la quantité en stock est inférieure ou égale au seuil d'alerte défini.

**Formule :** Quantité actuelle ≤ Seuil d'alerte → Article en alerte

**Fichier :** `src/data/dashboard.js`

**Fonction :** `fetchAlertArticles()` — filtre côté JS après requête

**Ligne approximative :** ~33

**Variables depuis app_settings :** non — le seuil est défini article par article dans `articles.low_stock_threshold`

**Modifiable sans code :** oui — en modifiant `low_stock_threshold` dans le catalogue pour chaque article

**Risque modification :** faible

**Pourquoi ce risque :** Ne touche qu'à l'affichage des alertes, pas au stock réel.

**Dépend de :** vue SQL `current_stock`, colonne `articles.low_stock_threshold`

---

## 5. Couleur du KPI "Écarts du mois" (Dashboard)

**Description :** Détermine la couleur du KPI des écarts constatés ce mois-ci : vert (zéro), orange (écart présent mais sous le seuil), rouge (écart au-dessus du seuil).

**Formule :**
- Écart = 0 → vert
- 0 < Écart < Seuil d'alerte valeur → orange
- Écart ≥ Seuil d'alerte valeur → rouge

**Fichier :** `src/pages/Dashboard.jsx`

**Fonction :** expression ternaire dans le JSX de `KpiCard` "Écarts du mois"

**Ligne approximative :** ~162

**Variables depuis app_settings :** **oui** — `seuil_ecart_valeur` (valeur par défaut : 500 MAD)

**Modifiable sans code :** **oui** — via Paramètres → Réglages → "Seuil valeur écart"

**Risque modification :** faible

**Pourquoi ce risque :** Ne touche qu'à l'affichage de la couleur, pas au calcul des écarts.

**Dépend de :** Logique n°6 (calcul des écarts du mois, fait en SQL via `get_dashboard_stats`)

---

## 6. Calcul des écarts du mois (Dashboard)

**Description :** Somme la valeur financière de tous les écarts constatés lors des événements clôturés ce mois-ci.

**Formule :** calculé en SQL par la RPC `get_dashboard_stats` — non recalculé côté React

**Fichier :** `src/data/dashboard.js` (appel) + RPC SQL `get_dashboard_stats`

**Fonction :** `fetchDashboardStats()`

**Ligne approximative :** `dashboard.js` ~4

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** élevé

**Pourquoi ce risque :** Toute modification de la RPC SQL impacte directement le KPI affiché sur le Dashboard.

**Dépend de :** table `stock_movements` (type `perte`), logique n°5 (couleur)

---

## 7. Valeur totale prélevée (Bon de prélèvement)

**Description :** Calcule la valeur financière totale de tous les articles prélevés pour un événement, affichée sur le bon imprimable.

**Formule :** Somme de (Quantité prélevée × Dernier prix d'achat) pour chaque article = Valeur totale prélevée

**Fichier :** `src/pages/Evenements.jsx`

**Fonction :** `aggregated.reduce(...)` dans `BonPrelevement`

**Ligne approximative :** ~55

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** modéré

**Pourquoi ce risque :** Utilise `last_purchase_price` (et non le CMP) — choix intentionnel pour le budget prévisionnel événement, à ne pas confondre avec la valorisation dépôt.

**Dépend de :** champ `articles.last_purchase_price`

---

## 8. Valeur totale des prélèvements actifs (Détail événement)

**Description :** Affiche la valeur financière de tout ce qui a été prélevé pour un événement en cours, dans l'interface de gestion de l'événement.

**Formule :** Somme de (Quantité prélevée agrégée × Dernier prix d'achat) pour chaque article

**Fichier :** `src/pages/Evenements.jsx`

**Fonction :** `aggregatedWithdrawals.reduce(...)` nommé `totalWithdrawValue`

**Ligne approximative :** ~607

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** faible

**Pourquoi ce risque :** Affichage uniquement, ne modifie pas le stock.

**Dépend de :** Logique n°7 (même base de calcul), champ `articles.last_purchase_price`

---

## 9. Calcul des écarts par article (Retours événement)

**Description :** Pour chaque article prélevé lors d'un événement, calcule la différence entre ce qui a été sorti du dépôt et ce qui est revenu.

**Formule :** Quantité prélevée − Quantité retournée = Écart (plancher à 0 — jamais négatif)

**Fichier :** `src/pages/Evenements.jsx`

**Fonction :** `useMemo(...)` nommé `rows` dans `RetourSection`

**Ligne approximative :** ~425

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** modéré

**Pourquoi ce risque :** Un écart calculé à tort génère un mouvement de stock `perte` incorrect et fausse les statistiques du mois.

**Dépend de :** logique n°10 (valeur monétaire de l'écart)

---

## 10. Valeur monétaire des écarts (Retours événement)

**Description :** Traduit les écarts en unités (articles manquants) en valeur financière, affichée sur le bon de retour et dans le récap.

**Formule :** Somme de (Écart en unités × Dernier prix d'achat) pour chaque article = Valeur totale des écarts

**Fichier :** `src/pages/Evenements.jsx`

**Fonction :** `rows.reduce(...)` nommé `totalEcartValue` dans `RetourSection` et `BonRetour`

**Ligne approximative :** ~434 (RetourSection) et ~139 (BonRetour)

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** modéré

**Pourquoi ce risque :** Utilise `last_purchase_price` — cohérent avec la valorisation événement, mais toute modification du prix d'achat d'un article après l'événement n'est pas rétroactive.

**Dépend de :** Logique n°9 (écart en unités), champ `articles.last_purchase_price`

---

## 11. TTL du cache Dashboard

**Description :** Durée pendant laquelle les données du Dashboard sont mises en cache avant d'être rechargées automatiquement depuis la base de données.

**Formule :** Valeur en secondes × 1000 = Durée de validité du cache en millisecondes

**Fichier :** `src/pages/Dashboard.jsx`

**Fonction :** `load()` — `const ttl = Number(cfg.dashboard_cache_ttl ?? 120) * 1000`

**Ligne approximative :** ~77

**Variables depuis app_settings :** **oui** — `dashboard_cache_ttl` (valeur par défaut : 120 secondes)

**Modifiable sans code :** **oui** — via Paramètres → Réglages → "Durée du cache Dashboard"

**Risque modification :** faible

**Pourquoi ce risque :** Une valeur trop basse ralentit l'app (requêtes fréquentes), une valeur trop haute retarde l'affichage des données récentes.

---

## 12. Total d'un achat (formulaire Achats)

**Description :** Calcule et affiche en temps réel le montant total d'un achat pendant la saisie du formulaire.

**Formule :** Quantité × Prix unitaire = Total de l'achat

**Fichier :** `src/pages/Achats.jsx`

**Fonction :** expression inline dans `PurchaseModal` JSX

**Ligne approximative :** ~191

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** faible

**Pourquoi ce risque :** Affichage uniquement — le vrai calcul est fait en SQL (`total_price GENERATED ALWAYS AS (quantity * unit_price) STORED`).

**Dépend de :** colonne SQL `purchases.total_price` (calcul identique mais côté base de données)

---

## 13. Valeur par catégorie (Dépôt)

**Description :** Affiche la valeur totale du stock pour chaque catégorie d'articles dans la page Dépôt.

**Formule :** Somme des valeurs de stock de tous les articles d'une même catégorie = Valeur de la catégorie

**Fichier :** `src/pages/Depot.jsx`

**Fonction :** `items.reduce(...)` dans le rendu JSX par catégorie

**Ligne approximative :** ~195

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** faible

**Pourquoi ce risque :** Sous-total d'affichage uniquement, dérivé de la logique n°1.

**Dépend de :** Logique n°1 (valeur totale du stock), logique n°2 (CMP)

---

## 14. Pré-remplissage inventaire depuis le stock actuel

**Description :** Remplit automatiquement les champs de quantité vides d'un inventaire en cours avec les quantités actuelles du stock.

**Formule :** Si quantité saisie = vide → remplacer par quantité du stock actuel (depuis la vue `current_stock`)

**Fichier :** `src/pages/Inventaire.jsx`

**Fonction :** `prefillFromStock()`

**Ligne approximative :** ~139

**Variables depuis app_settings :** non

**Modifiable sans code :** non

**Risque modification :** modéré

**Pourquoi ce risque :** Si utilisé sans contrôle, efface les saisies manuelles déjà faites (seuls les champs vides sont touchés — protection en place).

**Dépend de :** vue SQL `current_stock`

---

## Résumé des variables app_settings utilisées dans les calculs

| Clé app_settings | Valeur par défaut | Utilisée dans | Logique n° |
|---|---|---|---|
| `dashboard_cache_ttl` | 120 (secondes) | Dashboard — durée cache | 11 |
| `seuil_ecart_valeur` | 500 (MAD) | Dashboard — couleur KPI écarts | 5 |

Toutes les autres logiques utilisent des valeurs codées en dur ou des données issues directement de la base de données.
