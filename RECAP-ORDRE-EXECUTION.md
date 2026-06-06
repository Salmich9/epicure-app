# RECAP — Ordre d'exécution : Briefing Événement

## 1. Supabase — Exécuter la migration SQL

Dans le **SQL Editor** de Supabase, coller et exécuter le contenu de :

```
supabase/migrations/007_event_briefing.sql
```

Ce script crée la table `event_briefing` avec RLS activé.

---

## 2. Supabase — Créer le bucket Storage (pour les photos)

Dans Supabase Dashboard → **Storage** → **New bucket** :
- Nom : `briefing-photos`
- Public : ✅ Oui

Sans ce bucket, les photos du repérage ne fonctionneront pas,
mais tout le reste du formulaire fonctionne normalement.

---

## 3. GitHub — Push des fichiers

```bash
git add supabase/migrations/007_event_briefing.sql \
        src/data/briefingConfig.js \
        src/data/briefing.js \
        src/components/briefing/BriefingForm.jsx \
        src/pages/Evenements.jsx \
        RECAP-ORDRE-EXECUTION.md

git commit -m "feat: add Briefing Événement — formulaire Q&A conditionnel 8 sections"
git push
```

Vercel redéploie automatiquement (~1 min).

---

## 4. Tester dans l'app

1. Ouvrir un événement existant dans la page Événements
2. Cliquer sur l'onglet **Briefing**
3. Remplir quelques questions → cliquer **Sauvegarder**
4. Recharger la page → les réponses doivent persister ✓

---

## Fichiers créés / modifiés

| Fichier | Rôle |
|---|---|
| `supabase/migrations/007_event_briefing.sql` | Table `event_briefing` + RLS |
| `src/data/briefingConfig.js` | **Source de vérité unique** — 8 sections, toutes les questions, conditions, types |
| `src/data/briefing.js` | Fetch / save / upload photo (Supabase) |
| `src/components/briefing/BriefingForm.jsx` | Renderer générique — lit le config, aucune question en dur |
| `src/pages/Evenements.jsx` | +import BriefingForm, +onglet "Briefing" dans EvenementDetail |

## Pour modifier le formulaire

**Éditer uniquement** `src/data/briefingConfig.js` :
- Ajouter une section → ajouter un objet dans `BRIEFING_SECTIONS`
- Ajouter une question → ajouter dans `questions[]` de la section
- Modifier une condition → modifier `showIf` de la question
- Changer des options → modifier `options[]`
- Déplacer une question → couper/coller dans le tableau

Aucune modification du renderer nécessaire.
