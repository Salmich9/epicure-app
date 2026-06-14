\# CONTEXTE\_EPICURE — Reprise de conversation



\## App

Epicure — PWA de gestion de stock (phase actuelle) + gestion d'événements (à venir).

Stack : React 18 + Vite + Supabase + Tailwind + React Router + Lucide + react-hot-toast



\## Base de données Supabase

Tables : articles, categories, units, current\_stock (vue), stock\_movements,

inventories, inventory\_lines, events, event\_responsibles,

users, roles, permissions, audit\_log



\## Où on en est — Phase 4

Fichiers créés (pas encore pushés sur GitHub) :

\- dashboard.js

\- cache.js

\- syncQueue.js

\- useOnlineStatus.js



En cours de création (interrompu) :

\- OfflineBanner.jsx



RPC Supabase créée (pas encore exécutée) :

\- get\_dashboard\_stats() → retourne depot\_value, events\_en\_cours, ecarts\_mois, articles\_alerte



\## Prochain prompt

1\. Exécuter la RPC get\_dashboard\_stats() dans Supabase

2\. Finir OfflineBanner.jsx

3\. Connecter le dashboard aux stats RPC



\## Règles importantes

\- Ne pas dupliquer la logique métier

\- current\_stock est une VUE (pas une table modifiable)

\- Auth par PIN (pin\_hash dans users)

