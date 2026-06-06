# Epicure — Gestion du dépôt (Phase 1)

Application web interne pour la gestion du dépôt central Epicure.

---

## Prérequis

- [Node.js 18+](https://nodejs.org/) (LTS recommandé)
- Un projet [Supabase](https://supabase.com) créé

---

## 1. Installation

```bash
cd C:\Users\salma\epicure-app
npm install
```

---

## 2. Configuration Supabase

### 2a. Créer le fichier `.env`

```bash
copy .env.example .env
```

Puis remplis dans `.env` :
- `VITE_SUPABASE_URL` → Settings > API > Project URL
- `VITE_SUPABASE_ANON_KEY` → Settings > API > anon/public key

### 2b. Appliquer les migrations SQL

Dans le **SQL Editor** de Supabase, exécute dans l'ordre :

1. Contenu de `supabase/migrations/001_schema.sql`
2. Contenu de `supabase/migrations/002_seed.sql`

### 2c. Créer le bucket Storage

Dans Supabase > **Storage** :
- Crée un bucket nommé `article-photos`
- ✅ Coche **Public bucket**

---

## 3. Lancer l'application

```bash
npm run dev
```

Ouvre [http://localhost:5173](http://localhost:5173)

**Connexion initiale :**  
Nom : `Salmane` · PIN : `100001`

---

## Structure du projet

```
src/
├── lib/          # Supabase client + utilitaires (formatMAD, dates…)
├── data/         # Couche d'accès aux données (isolée pour Phase 4 hors-ligne)
├── contexts/     # AuthContext (session PIN + permissions en mémoire)
├── hooks/        # usePermission
├── components/
│   ├── ui/       # Button, Modal, Input, Badge, Spinner, ConfirmDialog
│   └── layout/   # AppLayout, Sidebar
└── pages/        # Login, Catalogue, Depot, Inventaire, Parametres, Historique
```

## Sécurité et authentification

- **PIN hashé bcrypt** (pgcrypto) — jamais en clair dans la base
- **Session stockée en localStorage** (outil interne sur tablette)
- **Permissions lues depuis la table `permissions`** — aucun rôle codé en dur dans le code
- **RLS Supabase activée** sur toutes les tables

## Checklist de validation (Phase 1)

- [ ] Connexion au PIN ✓
- [ ] Créer catégorie + unité depuis Paramètres ✓
- [ ] Ajouter un article avec photo en < 20s ✓
- [ ] Supprimer (soft-delete) avec confirmation ✓
- [ ] Créer inventaire → compter → signer → valider ✓
- [ ] Voir valeur totale du dépôt mise à jour ✓
- [ ] Retrouver toutes les actions dans Historique ✓
- [ ] Créer utilisateur + modifier permissions ✓
