# RECAP Epicure App — Architecture & Vision
*Dernière mise à jour : 14/06/2026*

---

## 1. STACK TECHNIQUE
- React + Vite + Tailwind (frontend)
- Supabase (base de données)
- GitHub (versioning)
- Vercel (déploiement)
- Développement local via Claude Code
- Path local : C:\Users\salma\epicure-app\

---

## 2. ENVIRONNEMENTS

| | Dev | Prod |
|---|---|---|
| Branche GitHub | dev | main |
| Vercel | URL preview | URL principale |
| Supabase | epicure-dev | epicure (prod) |

Workflow :
1. Claude Code travaille sur branche dev
2. Test sur URL preview Vercel
3. Validé → merge dans main
4. Cassé → revert en 30 secondes

---

## 3. RÈGLES ABSOLUES D'ARCHITECTURE

- **Aucune valeur métier dans le code** — tout dans Supabase
- **Catalogue = source unique de vérité** pour tous les articles
- **stock_movements = source unique du stock** — le dépôt est toujours un calcul dynamique
- **app_settings = toutes les valeurs métier** (seuils, ratios, suggestions, taux de retour)
- **app_logic = miroir en français de toutes les logiques React**
- **Un prompt Claude Code = une seule tâche**
- **Health check avant ET après chaque session**
- **Jamais de merge dans main sans test validé sur dev**
- **Toute logique React référence les questions par id — jamais par texte ou position**
- **Chaque modification crée une nouvelle version du schéma briefing**
- **Le passé est toujours protégé — jamais de modification rétroactive sans confirmation**

---

## 4. FICHIERS IMPORTANTS DU PROJET

| Fichier | Rôle |
|---|---|
| RECAP.md | Mémoire architecture — lu par Claude Code à chaque session |
| BRIEFING_V1.md | Structure complète du briefing événement |
| LOGIQUES.md | Toutes les logiques de calcul en français — à créer |

---

## 5. ARCHITECTURE DES DONNÉES

### Chaîne principale
```
Catalogue → Inventaire → Dépôt → Briefing → Paniers → Stock mis à jour
```

### Dépôt
```
Dépôt actuel =
Dernier inventaire validé
+ Achats réceptionnés
+ Retours événements validés
- Prélèvements validés
- Pertes/casse enregistrées
```

### Stock movements
Chaque action génère une ligne dans stock_movements :
- article_id
- type_mouvement (prélèvement, retour, achat, casse, correction, production)
- quantite
- justification
- responsable_id
- date_heure
- event_id (si lié à un événement)

---

## 6. TABLES SUPABASE EXISTANTES

### articles
- id (uuid), name, category_id, unit_id, type (consommable/retournable)
- active, low_stock_threshold, last_purchase_price, average_cost, photo_url

### categories (13 catégories)
- Base alcool, Base verrerie, Base coupage (sodas/Red Bull uniquement)
- Base eau (eau plate et gazeuse uniquement), Base hygiène
- Base matériel service, Base déco bar, Base logistique
- Base matériel bar, Base premix (jus/sirops/garnitures/premix faits maison)
- Base commune (glaçons/condiments/électrique/technique)
- Base nourriture (repas staff — articles génériques)
- Base transport (véhicules — articles génériques)
- Base fabrication (bars mobiles, structures, déco custom) ← à créer

### units
Paquet, Bouteille, Bidon, Rouleau, Litre, Carton, Pièce

### event_baskets
Table centrale des paniers événement :
- event_id, article_id
- type_panier (prélèvement/achat/location/production/fabrication/transport/nourriture)
- quantite_demandee ← figée à la validation briefing
- quantite_realisee ← saisie par le responsable terrain
- ecart ← calculé automatiquement
- justification_ecart
- nouveau_stock_confirme ← si justification = stock_reel_insuffisant
- last_purchase_price ← prix au moment de la validation
- prix_override ← optionnel, prix négocié pour cet événement
- prix_final = prix_override ?? last_purchase_price
- responsable_id, statut, remarque

### purchases (achats indépendants)
- id, article_id, quantite_commandee, quantite_receptionee
- fournisseur, prix_unitaire_reel, date_commande, date_reception
- statut, declencheur (seuil_alerte/strategique)
- responsable_id, event_id (nullable — si lié à un événement)

### stock_movements
- id, article_id, type_mouvement, quantite
- justification, responsable_id, date_heure, event_id

### app_settings
Toutes les valeurs métier :
- Ratios de consommation par type/moment/saison
- Coefficients fonte glaçons
- Taux de retour estimé
- Seuils suggestions pax-based
- Recettes premix et infusions
- Fiches de fabrication
- Délais production (J-3 premix...)
- Associations thèmes → déco
- Volumes logistique par article

### app_logic ← à créer
Miroir en français de toutes les logiques React :
- id, nom, description_francais, formule_francais
- variables_utilisees (json), valeurs_actuelles (json)
- fichier_react, fonction_react, ligne_approximative
- niveau_risque (faible/modere/eleve)
- modifiable_sans_code (bool), actif (bool), version

### briefing_questions ← à créer
- id, section_id, ordre, question, type
- obligatoire, options (json), source_options
- panier_genere, action_generee
- condition_affichage (json)
- parent_question_id ← clé du récursif
- parent_reponse_valeur
- statut (active/desactivee/verrouillee)
- dependances (json)
- modifiable_texte, modifiable_type, modifiable_action
- supprimable (bool)

### briefing_schema_versions ← à créer
- version, date_creation
- questions (snapshot complet)
- actif (bool)

### question_dependencies ← à créer
- question_id, depend_de_question_id
- type_dependance (affichage/calcul/panier/pdf/...)
- description (français), propagation_auto (bool)

### dependency_types ← à créer
- id, nom, icone, description, couleur, actif, ordre_affichage

### clients ← à créer
- id, nom, téléphone, email, historique events

### venues ← à créer
- id, nom, adresse, contact, type, photos, contraintes, historique events

### employees ← à créer
- id, nom, téléphone, rôle, niveau, tarif_horaire
- disponibilités, notes, actif, historique events

### prestataires ← à créer
- id, nom, rôle, téléphone, email, mode_contact
- articles_fournis, historique events, note_moyenne

### sharing_profiles ← à créer
- id, nom, infos_generales, menu_boissons, checklist
- bon_prelevement, budget, alertes_stock, staff, production (bool)

---

## 7. LOGIQUE STOCK TEMPS RÉEL

### Principe
Chaque action terrain = correction immédiate du stock.
L'inventaire complet = vérification de contrôle, pas nécessité hebdomadaire.

### Actions qui modifient le stock
| Action | Impact |
|---|---|
| Prélèvement validé | Déduction immédiate |
| Retour validé | Restitution immédiate |
| Achat réceptionné | Ajout + MAJ last_purchase_price + recalcul CMP |
| Casse déclarée | Déduction + enregistrement perte |
| Ecart stock_reel_insuffisant | MAJ stock + mini-inventaire correctif |
| Production validée | Ajout au stock |

### Stock tampon événement
```
Briefing validé → stock - quantite_demandee = stock tampon
Responsable valide → stock tampon + (demandée - realisee) = stock final
```

### Coût moyen pondéré (CMP)
```
CMP = (stock actuel × prix_moyen + quantité × nouveau_prix) ÷ nouveau_stock
Stocké dans : articles.average_cost
Déclenché à : chaque réception achat
```

### Justifications écart prélèvement
| Justification | Impact dépôt |
|---|---|
| Stock réel insuffisant | MAJ dépôt + mini-inventaire correctif |
| Casse découverte | Déduction + enregistrement perte |
| Article mal rangé | Alerte sans MAJ |
| Oubli de chargement | Pas de déduction |
| Injustifié | Signalement associé |

---

## 8. LOGIQUE INVENTAIRE

- Pré-rempli depuis le dépôt actuel calculé
- Justification obligatoire pour tout écart avant validation
- Archivé après validation — jamais supprimé
- Mini-inventaire correctif créé automatiquement si stock_reel_insuffisant

---

## 9. LOGIQUE BRIEFING ÉVÉNEMENT

### Ce que le briefing fait simultanément
1. Collecte les informations de l'événement
2. Affiche le stock live entre parenthèses pour chaque article
3. Génère automatiquement les paniers selon besoin vs stock
4. Calcule le budget prévisionnel en temps réel
5. Détecte les conflits de stock avec les autres événements
6. Génère la timeline dynamique
7. Prépare les messages prestataires et staff
8. Génère le devis client

### Structure du briefing (11 sections)
1. Informations client
2. Configuration des bars
3. Menu par bar
4. Glaçons et coupage
5. Production / Fabrication
6. Prestataires externes
7. Déco bar
8. Logistique
9. Staff global
10. Checklist et timeline
11. Facturation globale

### Génération automatique des paniers
La catégorie de l'article détermine les actions proposées.
Stock > 0 → prélèvement
Stock = 0 → achat/location/fabrication
Stock insuffisant → les deux

### Calcul budget temps réel
```
prix_final = prix_override ?? last_purchase_price
montant = quantite × prix_final
```
Prix figé à la validation du briefing.
Prix override optionnel par article par événement.

### Versioning du schéma briefing
Chaque modification de question crée une nouvelle version.
Chaque briefing est lié à la version du schéma au moment de sa création.
Le passé est toujours protégé.

---

## 10. ÉDITEUR DE BRIEFING (Phase 5a)

### Principes
- Pédagogue : explique tout avant que tu touches quoi que ce soit
- Policier : empêche toute erreur avant qu'elle arrive
- Vue arbre : toutes les questions et sous-questions visibles
- Vue détail : au clic, tous les paramètres et dépendances

### Code couleur questions
- 🔒 Rouge → verrouillée, logique critique
- ✏️ Vert → libre, modifiable sans risque
- ⚠️ Orange → modifiable avec précaution
- 💤 Gris → désactivée

### 4 types de dépendances par question
1. 👁️ Affichage → questions qui apparaissent grâce à cette réponse
2. 🧮 Calculs → formules qui utilisent cette réponse
3. 🧺 Paniers → paniers générés depuis cette réponse
4. 📄 PDF → sections PDF qui affichent cette réponse

### Règles de modification
- Toute modification montre l'impact avant/après
- Propagation automatique à toutes les dépendances
- Désactivation au lieu de suppression
- Questions verrouillées : texte modifiable, type/action non

### Types de dépendances extensibles
Table dependency_types dans Supabase.
Nouvelle famille = nouvelle ligne dans Supabase, zéro code.

---

## 11. ÉDITEUR DE LOGIQUE (Phase 5b — en étapes)

### Vision
Toutes les logiques de calcul React sont visibles en français dans les paramètres.
Tu lis, tu comprends, tu modifies ce que tu peux seul.
Pour le reste → prompt Claude Code généré automatiquement.

### Construction en 5 mini-étapes
1. LOGIQUES.md ← prochaine étape
2. Page lecture seule dans l'app
3. Valeurs modifiables depuis la page
4. Propagation et impact affiché
5. Génération prompt Claude Code automatique

### 3 niveaux de modification
- 🟢 Modifiable seul → valeur dans app_settings
- 🟡 Modifiable avec prompt généré → Claude Code guidé
- 🔴 Lecture seule → audit obligatoire avant modification

### Mise à jour automatique
Quand une variable app_settings change →
toutes les logiques qui l'utilisent se mettent à jour dans app_logic →
impact affiché en temps réel →
aucune désynchronisation possible

---

## 12. VALIDATION TERRAIN

### Flux complet
1. Briefing validé → paniers générés → stock tampon déduit
2. PDF partagé avec responsables via WhatsApp
3. Responsable se connecte → renseigne quantité réellement réalisée
4. Justification obligatoire si écart
5. Validation → stock mis à jour définitivement
6. PDF rapprochement généré (demandé vs réalisé)

---

## 13. PDF ET PARTAGE

### Ordre des pages PDF complet
1. Couverture
2. Configuration opérationnelle
3. Menu boissons
4. Production / Fabrication
5. Bon de prélèvement / achat / location
6. Logistique
7. Staff
8. Checklist opérationnelle
9. Budget prévisionnel (Associés uniquement)
10. Alertes et notes (Associés uniquement)

### Profils de partage
Table sharing_profiles dans Supabase.
3 profils par défaut : Équipe, Associés, Prestataire.
Extensible sans code.

---

## 14. ACHATS INDÉPENDANTS

2 déclencheurs : alerte seuil automatique / décision stratégique.
Assignable à un événement ou indépendant.
À la réception : stock MAJ + last_purchase_price MAJ + CMP recalculé.
Création article à la volée depuis le formulaire d'achat.
Création fournisseur à la volée depuis le formulaire d'achat.

---

## 15. LOGIQUE CONFLITS ENTRE ÉVÉNEMENTS

### Niveaux d'alerte
| Ecart | Alerte |
|---|---|
| < 2 jours | 🔴 Critique |
| 2-5 jours | 🟠 Modérée |
| > 6 jours | 🟢 OK |

### Taux de retour estimé
| Type | Taux |
|---|---|
| Consommable | 0% |
| Retournable | 95% |
| Verrerie | 80% |

### Formule stock estimé Event N
```
Stock estimé =
Stock dépôt actuel
- Σ (quantite_demandee - retour estimé) pour tous les events précédents
```

---

## 16. PLAN D'ATTAQUE — PHASES

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Health check + stabilisation bugs | ✅ Fait |
| Setup | 2 environnements dev/prod | ✅ Fait |
| 1 | Catalogue + app_settings | ✅ Fait |
| 2 | Stock temps réel (stock_movements) | ✅ Fait |
| 3 | Inventaire intelligent | ✅ Fait |
| 4 | Achats indépendants + CMP + création à la volée | ✅ Fait |
| 5a | Éditeur de briefing visuel | ⏳ À faire |
| 5b | Éditeur de logique (5 mini-étapes) | ⏳ À faire |
| 6 | Briefing → paniers + budget | ⏳ À faire |
| 7 | Validation terrain + rapprochement | ⏳ À faire |
| 8 | PDF et partage WhatsApp | ⏳ À faire |
| 9 | Conflits entre événements | ⏳ À faire |
| 10 | Paramètres et tarification | ⏳ À faire |
| 11 | Historique et analytics | ⏳ À faire |

---

## 17. PROCHAINE ACTION IMMÉDIATE

**Étape 1 — Créer LOGIQUES.md**

Prompt à donner à Claude Code :

"Lis RECAP.md. Health check avant de commencer.

Crée un fichier LOGIQUES.md à la racine du projet.

Ce fichier documente en français simple TOUTES les logiques
de calcul actuellement codées dans React.

Pour chaque logique :

## Nom de la logique
Description : ce que ça fait en une phrase
Formule : A + B - C = D (en français métier, zéro jargon)
Fichier : nom_du_fichier.js
Fonction : nomDeLaFonction()
Ligne approximative : ~145
Variables depuis app_settings : oui/non — lesquelles
Modifiable sans code : oui/non
Risque modification : faible / modéré / élevé
Pourquoi ce risque : explication en une phrase
Dépend de : autres logiques liées
Dernière modification : date

Règles absolues :
- Langage français simple — zéro jargon technique
- Explique comme à un restaurateur qui ne connaît pas le code
- Une logique = une entrée
- Si une logique dépend d'une autre → l'indiquer
- Montre-moi le fichier complet avant de l'enregistrer
- Ce fichier doit être mis à jour après chaque session Claude Code

Ne touche à rien d'autre. Health check après."

---

## 18. BUGS CONNUS
- ⚠️ Bucket photo article-photos vs article_photos (à corriger)

## 19. CE QUI FONCTIONNE
- ✅ Catalogue 100+ articles avec CMP
- ✅ Dépôt stock temps réel
- ✅ Inventaire intelligent avec justifications
- ✅ Prélèvements avec chargement automatique dépôt
- ✅ Retours avec validation écarts
- ✅ Achats indépendants et liés événements
- ✅ Création article et fournisseur à la volée
- ✅ 2 environnements dev/prod configurés
- ✅ Bug double stock corrigé

## 20. RÈGLES À RAPPELER À CLAUDE CODE
À coller en haut de chaque prompt :
"Règle absolue : aucune valeur métier dans le code, tout dans Supabase.
Travaille uniquement sur la branche dev.
Lis RECAP.md avant de commencer.
Health check avant et après.
Un prompt = une seule tâche.
Montre-moi ce que tu vas faire avant de le faire."
