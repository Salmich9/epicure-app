# BRIEFING ÉVÉNEMENT — Structure complète v1

---

## PRINCIPES FONDAMENTAUX

- Chaque réponse = une action ou une information
- Tout est connecté au catalogue (source unique de vérité)
- Stock live visible à chaque sélection d'article
- Suggestions automatiques basées sur le nombre de pax, la saison, le moment de service
- Tous les ratios et seuils dans app_settings — modifiables dans les paramètres
- Une seule saisie — jamais réécrire deux fois la même chose
- Les paniers sont générés automatiquement depuis les réponses

---

## TABLES SUPABASE À CRÉER

### clients
- id, nom, téléphone (WhatsApp), email, historique events

### venues (lieux)
- id, nom, adresse, contact, type, photos, contraintes connues, historique events

### employees (staff)
- id, nom, téléphone, rôle principal, niveau, tarif horaire, disponibilités, notes, actif, historique events

### prestataires
- id, nom, rôle, téléphone, email, mode contact préféré, articles fournis (exclus paniers), historique events, note moyenne

### event_briefing (déjà existante — à enrichir)
- Toutes les réponses du briefing par section

---

## OUTPUTS AUTOMATIQUES DU BRIEFING

| Output | Source |
|--------|--------|
| Panier prélèvement | Sections 2, 3, 4, 7 |
| Panier achat | Gaps détectés vs stock |
| Panier location | Matériel insuffisant |
| Panier production | Section 5 (premix, infusions) |
| Panier fabrication | Section 5 (bars, déco) |
| Panier transport | Section 8 |
| Budget prévisionnel | Toutes sections |
| Timeline dynamique | Section 10 |
| Messages prestataires | Section 6 |
| Devis client | Section 11 |
| Facture finale | Clôture event |
| Export Zoho Books | Section 11 |

---

## SECTION 1 — INFORMATIONS CLIENT

### Identité événement
- Nom de l'événement
- Type (Mariage, Soirée privée, Cocktail dînatoire, Séminaire, Festival, Autre)
- Thème ou ambiance → alimente suggestions déco automatiquement
- Niveau de prestation (standard, premium, luxe)
- Contraintes particulières (allergies, restrictions religieuses, autres)
- Remarques générales

### Client
- Nom (existant → pré-remplissage auto / nouveau → créé dans table clients)
- Téléphone WhatsApp
- Email
- Contact sur place jour J (si différent)
- Téléphone contact jour J
- Budget global estimé

### Date et horaires
- Date de l'événement → saison détectée automatiquement
- Heure d'arrivée Epicure sur site
- Heure d'ouverture des bars
- Heure de fermeture des bars
- Heure de démontage
- Durée totale

### Lieu
- Nom du lieu (existant → pré-remplissage auto / nouveau → créé dans table venues)
- Adresse complète
- Contact du lieu (nom + téléphone)
- Type (villa privée, hôtel, salle de réception, plein air, autre)
- Visite préalable effectuée ? (oui/non)
  - Si oui → infos et photos de visite chargées automatiquement
  - Si non → alerte ⚠️ "Visite préalable non effectuée"

### Convives
- Nombre de convives adultes → base de tous les calculs de ratios
- Nombre de convives enfants
- Ratio estimé hommes/femmes (optionnel)
- Convives VIP ? (oui/non → qui ?)

---

## SECTION 2 — CONFIGURATION DES BARS

### Visite préalable (par emplacement de bar)
- Date de la visite
- Qui visite ? (Salmane, Hamza, Soufiane, chef de production...)
- Photos de l'emplacement (upload)
- Notes par emplacement
- Contraintes identifiées → sauvegardées dans table venues

### Par bar (répété pour chaque bar) :

**Type de bar**
- Bar construit sur place par le lieu
- Bar mobile Epicure (Base fabrication) → stock vérifié → prélèvement ou fabrication
- Bar loué externe → panier location
- Bar improvisé (table + nappe)
- Combinaison

**Si bar construit sur place :**
- Photos du bar (depuis visite)
- Dimensions (L × l × H)
- Accès électricité (oui/non — prises, puissance)
- Accès eau courante (oui/non)
- Espace stockage derrière (oui/non — m²)
- Bar utilisable tel quel ? (oui/non)
- Si non → qu'est-ce qui manque ?

**Si bar mobile Epicure :**
- Quel modèle ? (liste déroulante Base fabrication)
- Stock > 0 → prélèvement / Stock = 0 → fabrication / Insuffisant → les deux
- Photos emplacement prévu (depuis visite)
- Dimensions espace disponible
- Type de sol (dur, gazon, sable, carrelage, autre)
- Accès électricité (oui/non)
- Accès eau courante (oui/non)
- Accès livraison facile (oui/non — contraintes)
- Distance depuis point de déchargement

**Equipement technique (par équipement)**
- Qui fournit ? (Epicure / Lieu / Prestataire)
- Si Epicure → sélection catalogue → stock vérifié → panier auto
- Frigos (oui/non — quantité)
- Machine à glace (oui/non)
- Machine à café (oui/non)
- Blender (oui/non — quantité)
- Eclairage bar (oui/non — type)
- Sono propre au bar (oui/non)

**Emplacement et accès**
- Localisation exacte dans le lieu
- Superficie du bar (m²)
- Nombre de faces de service (1, 2, 3, 4)
- Hauteur de service (standard, haute, basse)
- Distance depuis point de stockage sur site

**Staff affecté à ce bar**
- Nombre de bartenders
- Nombre de runners
- Chef de bar désigné (oui/non — qui ?)
- Heure d'arrivée staff ce bar
- Heure de fin staff ce bar

**Service**
- Heure d'ouverture ce bar
- Heure de fermeture ce bar
- Service continu ou par sessions ?
- Bar principal ou secondaire ?
- Bar enfants ? (oui/non — softs uniquement)

**Facturation ce bar**
- Entité facturante (Epicure Catering / Central Bistro / Business Boys / KPI Gestion / Autre)
- Bar inclus dans forfait global ou facturation séparée ?

---

## SECTION 3 — MENU PAR BAR

*(Répété pour chaque bar)*

### Cocktails (max 8 par bar — classiques + signature confondus)

**Par cocktail :**
- Classique ou signature ? (distinction visuelle/commerciale uniquement)
- Lequel ? (liste déroulante carte Epicure — stock live)
- Servi dans quel verre ? (liste déroulante catalogue — stock live)
- Glaçons ? (sans, cube alimentaire, transparent)
- Quel garnish ? (liste déroulante catalogue — stock live)
- Facturation garnish ? (Epicure Catering / Central Bistro / Business Boys / KPI Gestion / Espèces)
- Quel alcool ? (liste déroulante catalogue — stock live)
- Dosage alcool ? (2cl, 3cl, 4cl, 5cl, 6cl)
- Service alcool ? (bouteille d'origine, carafe, bouteille noire)
- Estimation bouteilles automatique = pax × ratio × dosage ÷ contenance
- Combien de cocktails servis au total ?
- Servi à la minute ou premix ?
  - Si premix → combien de litres à produire ?
  - Si premix → service ? (ready service, carafe, bouteille noire)
  - Si premix → facturation ingrédients ?
  - Si premix → remarques goût/couleur/texture/degré ?
- Prévoir service en shots ? (oui/non)
- Facturation alcool ? (Epicure Catering / Central Bistro / Business Boys / KPI Gestion / Espèces)

### Shots
- Lié à un cocktail du menu ? → liste déroulante cocktails sélectionnés → pas de doublon panier
- Indépendant ? → sélection carte Epicure → questions détaillées
- Estimation automatique = pax × ratio shots × dosage ÷ contenance

### Spiritueux à la carte
- Lequel ? (liste déroulante catalogue Base alcool — stock live)
- Qui fournit ? (Epicure / Client / Prestataire)
- Service ? (bouteille d'origine, carafe, bouteille noire)
- Glaçons ? (sans, cube, transparent)
- Accompagnements ? (liste déroulante catalogue)
- Estimation bouteilles automatique = pax × ratio par type de spiritueux × dosage ÷ contenance
- Facturation ?
- Ratios par type : Whisky 0.4 / Vodka 0.3 / Cognac 0.15 / Tequila 0.2 / Gin 0.25 / Rhum 0.2
- Ratios s'affinent automatiquement avec l'historique

### Vins / Champagnes / Bières
- Qui fournit ? (Epicure / Client / Prestataire)
- Lequel ? (liste déroulante catalogue — stock live)
- Moment de service ? (accueil, toast, dîner, cocktail, soirée, pool/beach...)
- Estimation automatique selon ratio moment × saison
- Ratios champagne : accueil 0.5/pax / toast 1/pax
- Ratios vin : dîner rouge 1.5/pax / dîner blanc 1/pax / cocktail 0.8/pax
- Ratios bière : cocktail 0.3 / soirée 0.8 / dîner 0.5 / pool 1.2

### Mocktails
- Déclinaison d'un cocktail du menu → liste déroulante cocktails sélectionnés
  - Mêmes questions SAUF alcool et dosage
  - Pas de doublon sur ingrédients déjà dans panier cocktail
- Sur mesure → nom saisi + questions détaillées

### Softs / Eaux / Jus
- Suggestion automatique depuis ingrédients cocktails (ex: gin tonic → tonic suggéré)
- Softs supplémentaires → sélection catalogue → ratio saison × moment
- Déduplication automatique avec paniers cocktails

### Boissons chaudes
- Qui fournit le matériel ? (Epicure / Traiteur / Lieu)
- Qui fournit les consommables ? (Epicure / Traiteur / Lieu)
- Si Epicure → sélection catalogue → ratio saison × moment
- Ratios : café après dîner été 0.4 / hiver 0.7 / thé été 0.2 / hiver 0.5

---

## SECTION 4 — GLAÇONS ET COUPAGE

*(Coupage déjà couvert en Section 3)*

### Glaçons
- Qui fournit ? (Epicure / Lieu / Traiteur-Prestataire)
- Si Epicure → estimation automatique :

**4 sources de calcul :**
1. Glaçons cocktails → type détecté depuis Section 3 (cube, transparent, pilé)
2. Glaçons seaux champagne/vin → nb bouteilles × ratio glaçons × renouvellement
3. Glaçons bar général → pax × ratio × durée
4. Buffer sécurité % → configurable app_settings

**Coefficient de fonte (saison × type espace) :**
- Été intérieur climatisé → 1.2
- Été extérieur ombragé → 1.5
- Été extérieur soleil → 2.0
- Hiver intérieur → 1.0
- Hiver extérieur → 0.8

- Type d'espace détecté depuis configuration bar (Section 2)
- Saison détectée depuis date événement (Section 1)
- Total par type → stock live → panier achat si manque
- Validation ou modification manuelle

---

## SECTION 5 — PRODUCTION / FABRICATION

### Premix
- Détectés automatiquement depuis cocktails marqués "premix" en Section 3
- Recettes depuis app_settings (ingrédients + dosages)
- Quantité litres → ingrédients calculés automatiquement → paniers auto
- Date de production : J-3 automatique
- Remarques goût/couleur/texture/degré depuis Section 3

### Infusions
- Saisie manuelle selon l'événement
- Sélection depuis recettes app_settings (existantes ou nouvelles)
- Par infusion :
  - Alcool de base (liste déroulante catalogue — stock live)
  - Ingrédient d'infusion (liste déroulante catalogue — stock live)
  - Quantité à produire (litres)
  - Durée d'infusion (heures/jours)
  - Date de début calculée automatiquement
  - Pour quel cocktail / utilisation ?
  - Facturation ingrédients ?

### Fabrication (bars, structures, déco custom)
- Qui fabrique ? (Interne / Prestataire externe)
- Si interne :
  - Quoi ? (liste déroulante Base fabrication)
  - Fiche de fabrication chargée automatiquement depuis app_settings
  - Matériaux → stock vérifié → paniers auto
  - Responsable assigné
  - Date de fabrication calculée automatiquement
- Si prestataire → sélection liste → message automatique + devis

---

## SECTION 6 — PRESTATAIRES EXTERNES

### Par prestataire :
- Nom (existant → pré-remplissage / nouveau → créé dans table prestataires)
- Rôle (DJ, traiteur, décorateur, photographe, sono, autre)
- Téléphone WhatsApp
- Email
- Mode de contact préféré (WhatsApp / Email / Les deux)
- Ce qu'il fournit :
  - Articles du catalogue (exclus automatiquement des paniers)
  - Services non liés au catalogue
- Articles du catalogue liés à ce prestataire (mise à jour table articles)
- Tâches assignées :
  - Description de la tâche
  - Heure
  - Responsable Epicure assigné
  - Notes
- Message automatique généré :
  - Date et lieu de l'événement
  - Ce qu'il doit apporter
  - Tâches assignées
  - Envoi WhatsApp / Email / Les deux
- Historique events précédents avec ce prestataire
- Note moyenne affichée dans liste déroulante

### Evaluation post-event :
- Note globale (1 à 5)
- Ponctualité (1 à 5)
- Qualité de service (1 à 5)
- Respect des engagements (1 à 5)
- Commentaire libre
- Recommander ? (oui/non)
- Alerte si moyenne < 3 ⚠️

---

## SECTION 7 — DÉCO BAR

### Par élément de déco :
- Qui fournit ? (Epicure / Client / Décorateur / Lieu)
- Si Epicure → sélection catalogue Base déco bar (stock live) → panier auto
- Quantité
- Par bar ou global ?
- Thème/couleur spécifique ?
- Installation par qui ? (Epicure / Décorateur / Lieu)
- Heure d'installation

### Thème global (depuis Section 1) :
- Suggestions automatiques de déco depuis app_settings
- Associations thème → déco s'enrichissent avec l'historique

### Photos de référence client :
- Upload depuis téléphone
- Lien Pinterest/Instagram
- Notes sur le style souhaité

---

## SECTION 8 — LOGISTIQUE

### Véhicules
- Suggestion automatique basée sur volume estimé de tout le matériel
- Volumes par article dans app_settings
- Type et nombre (suggérés + modifiables manuellement)
- Qui conduit chaque véhicule ?
- Heure de départ calculée automatiquement :
  - Heure ouverture bars - trajet estimé - déchargement/installation - buffer 30min
- Point de chargement (dépôt Epicure ou autre)

### Accès site
- Accès livraison facile ? (pré-rempli depuis visite préalable)
- Contraintes particulières ?
- Contact sur place pour accès ?
- Heure d'accès autorisée au lieu ?

### Stockage sur place
- Espace disponible ? (pré-rempli depuis visite)
- Dimensions
- Sécurisé ? (oui/non)
- Accès électricité ? (pour frigos)

### Retour
- Heure de démontage
- Heure de retour au dépôt estimée
- Mêmes véhicules aller/retour ? (oui/non)

### Talkie-walkies
- Suggestion automatique basée sur pax :
  - < 100 pax → minimum 4
  - 100-200 pax → minimum 6
  - 200-400 pax → minimum 8
  - > 400 pax → minimum 10
- Quantité validée manuellement

---

## SECTION 9 — STAFF GLOBAL

### Estimation automatique
Basée sur pax × ratios app_settings :
- Nombre de bartenders suggérés
- Nombre de runners suggérés
- Chef de bar suggéré (oui/non)

### Par membre du staff :
- Sélection depuis table employees (existant / nouveau)
- Disponibilité ce jour :
  - 🟢 Disponible
  - 🟠 À confirmer
  - 🔴 Déjà assigné autre event
- Rôle assigné pour cet event
- Bar assigné
- Heure d'arrivée
- Heure de fin
- Note moyenne visible dans liste

### Contrats et paiements :
- Type de contrat (CDD, vacation, freelance)
- Heures travaillées (début → fin)
- Tarif horaire (depuis fiche employee ou modifiable)
- Total à payer = heures × tarif
- Statut paiement (en attente / payé / partiel)
- Mode de paiement (virement, espèces, chèque)
- Date de paiement
- Reçu / justificatif (upload)
- Export Zoho Books automatique

### Notes de frais :
- Transport (type, montant, justificatif)
- Repas (type, montant, justificatif)
- Autres frais (description, montant, justificatif)
- Toutes notes de frais → ajoutées au budget événement

### Evaluation post-event :
- Ponctualité (1 à 5)
- Qualité de service (1 à 5)
- Travail en équipe (1 à 5)
- Présentation / dress code (1 à 5)
- Initiative (1 à 5)
- Commentaire libre
- Réinviter ? (oui/non)
- Alerte si moyenne < 3 ⚠️

---

## SECTION 10 — CHECKLIST ET TIMELINE

### Timeline dynamique générée automatiquement
Facteurs pris en compte :
- Nombre de bars et complexité
- Cocktails et type de service
- Premix (J-3 fixe)
- Infusions (date calculée depuis durée)
- Fabrication (J-7 si complexe / J-3 si simple)
- Nombre de prestataires
- Distance du lieu
- Complexité logistique
- Nombre de staff

### Exemple timeline mariage complexe :
- J-14 → Confirmation commandes achats urgents
- J-10 → Fabrication bars mobiles démarrée
- J-7 → Réception achats / Briefing prestataires envoyé
- J-5 → Fabrication déco custom
- J-3 → Production premix / Infusions démarrées
- J-2 → Vérification stock / Messages confirmation prestataires
- J-1 → Chargement véhicules / Briefing staff / Livraison glaçons
- Jour J matin → Arrivée site + installation
- Jour J → Heures clés service
- J+1 → Retour stock / Validation écarts / Evaluations / Facturation

### Par tâche :
- Statut (à faire / en cours / fait / bloqué)
- Responsable assigné
- Date et heure limite
- Notification WhatsApp automatique (J-1 de la tâche)
- Validation dans l'app ✅
- Si bloqué → justification obligatoire + alerte Salmane
- Lien direct vers panier ou action concernée

### Vue progression :
- % de completion de l'event
- 🔴 Tâches en retard
- 🟠 Tâches à faire aujourd'hui
- 🟢 Tâches complétées
- Prochaine action mise en avant
- Exportable dans PDF associés

---

## SECTION 11 — FACTURATION GLOBALE

### Entités facturantes
- Epicure Catering SARL
- Central Bistro
- Business Boys
- KPI Gestion
- Autre (saisie manuelle)
- Un même event peut être facturé par plusieurs entités

### Par entité :
- Ce qui est facturé (prestations, articles...)
- Montant HT
- TVA applicable (oui/non — taux)
- Montant TTC

### Récapitulatif global :
- Total HT toutes entités
- Total TVA
- Total TTC
- Acompte reçu (montant + date + mode)
- Solde restant
- Date de solde prévue
- Mode de paiement (virement, espèces, chèque, mixte)

### Workflow devis :
- Génération automatique depuis budget prévisionnel
- Logo et en-tête par entité
- Numérotation automatique
- Envoi client (WhatsApp / Email / Les deux)
- Suivi statut (envoyé / vu / accepté / refusé)
- Relance automatique si pas de réponse sous X jours (configurable app_settings)
- Historique versions (v1, v2...)
- Accepté → event confirmé automatiquement

### Acompte :
- Montant demandé (% configurable app_settings)
- Date limite paiement
- Confirmation réception
- Relance automatique si non reçu

### Facture finale (générée à la clôture) :
- Basée sur ce qui a été réellement consommé vs estimé
- Estimé vs Réel par poste
- Ecarts justifiés
- Total réel par entité
- Acompte déduit
- Solde final à payer
- Export Zoho Books automatique
- Envoi client (WhatsApp / Email)

---

## LOGIQUE CONFLITS ENTRE ÉVÉNEMENTS

### 3 variables
1. Ecart de jours entre événements
2. Type d'article (consommable / retournable / verrerie)
3. Calcul cumulatif sur tous les événements à venir

### Niveaux d'alerte
| Ecart | Alerte |
|-------|--------|
| < 2 jours | 🔴 Critique — retour quasi impossible |
| 2-5 jours | 🟠 Modérée — retour possible mais risqué |
| > 6 jours | 🟢 OK — retour probable |

### Taux de retour estimé
| Type | Taux |
|------|------|
| Consommable | 0% |
| Retournable | 95% |
| Verrerie | 80% |

---

## APP_SETTINGS — VALEURS MÉTIER À CONFIGURER

### Ratios de consommation
- Cocktails par type et moment
- Shots
- Spiritueux par type (Whisky 0.4 / Vodka 0.3 / Cognac 0.15 / Tequila 0.2 / Gin 0.25 / Rhum 0.2)
- Vins/champagnes par moment (accueil 0.5 / toast 1 / dîner rouge 1.5 / dîner blanc 1)
- Bières par moment (cocktail 0.3 / soirée 0.8 / dîner 0.5 / pool 1.2)
- Softs/eaux par saison et moment
- Boissons chaudes par saison et moment
- Glaçons par type de service

### Coefficients de fonte glaçons
- Été intérieur climatisé → 1.2
- Été extérieur ombragé → 1.5
- Été extérieur soleil → 2.0
- Hiver intérieur → 1.0
- Hiver extérieur → 0.8

### Suggestions contextuelles (pax-based)
- Talkies-walkies : <100→4 / 100-200→6 / 200-400→8 / >400→10
- Bartenders par pax et nb bars
- Runners par pax

### Taux de retour estimé
- Consommable 0% / Retournable 95% / Verrerie 80%

### Devis et facturation
- % acompte demandé
- Délai relance devis (jours)
- Délai relance acompte (jours)

### Production
- Date production premix : J-3
- Buffer sécurité glaçons %

### Fiches fabrication
- Plans et instructions par élément (bars mobiles, structures...)

### Recettes infusions
- Par recette : alcool base, ingrédients, durée, ratio, remarques

### Recettes premix
- Par recette : ingrédients, dosages, remarques

### Associations thèmes → déco
- Par thème : liste articles déco suggérés

### Volumes logistique
- Volume estimé par article (pour suggestion véhicules)

---

## STATUT
- Brouillon v1 — documenté le 14/06/2026
- Pas encore codé
- A finaliser avant de passer à Claude Code (Phase 5 du plan d'attaque)
