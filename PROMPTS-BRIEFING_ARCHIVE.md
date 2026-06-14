# Prompts — Epicure App

## Push sur GitHub

```
git add .
git commit -m "..."
git push
```

Ou pour des fichiers spécifiques :
```
git add src/pages/Evenements.jsx src/data/briefingConfig.js
git commit -m "feat: description du changement"
git push
```

---

# Prompts — Modifier le Briefing Événement

Copie-colle l'un de ces modèles et adapte-le.
Le fichier à modifier est toujours : `src/data/briefingConfig.js`

---

## Ajouter une question

> Dans la section "Logistique Équipe" du briefing, ajoute une question "Nombre de serveurs" de type number, après "Nombre de talkies-walkies"

---

## Modifier les options d'une question

> Dans la section "Responsables opérationnels" du briefing, remplace les options de "Responsable mixologie" par : Salmane, Karim, Nadia, Autre

---

## Ajouter une condition sur une question

> Dans le briefing, la question "Nombre de serveurs" doit apparaître seulement si "Uniforme prévu" est "Oui"

---

## Supprimer une question

> Dans le briefing, supprime la question "Agence externe" de la section "Agence & Client"

---

## Ajouter une section

> Ajoute une 9e section "Budget" dans le briefing avec les questions : Budget total (number), Budget boissons (number), Budget logistique (number), Devise (select_one : MAD / EUR)

---

## Déplacer une question

> Dans le briefing, déplace la question "Thème" de la section "Informations générales" vers une nouvelle section "Ambiance"

---

## Changer le type d'une question

> Dans le briefing, change la question "Nationalités dominantes" de type text en type multi_select avec les options : Marocain, Français, Américain, Européen, Autre

---

## Renommer le label d'une question

> Dans le briefing, renomme le label "Lien Google Maps" en "Adresse & Lien Maps"

---

## Modifier le placeholder d'une question

> Dans le briefing, change le placeholder de "Nombre d'invités" en "Ex : 150"
