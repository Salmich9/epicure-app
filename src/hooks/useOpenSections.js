import { useState, useEffect, useCallback } from 'react';

const PREFIXE = 'epicure_sections_';

/**
 * Mémorise quelles familles d'articles sont dépliées, par écran.
 *
 * ON STOCKE LES SECTIONS OUVERTES, PAS LES FERMÉES. C'est le point de
 * conception. Le défaut voulu est « tout replié » : une clé absente, vidée par
 * le navigateur ou corrompue doit donc dégrader vers *tout replié*. Stocker les
 * fermées ferait exploser la page à 4 000 px au premier vidage du stockage, et
 * ferait apparaître dépliée toute famille créée après coup.
 *
 * LES CLÉS SONT DES UUID de catégorie, jamais des noms — renommables depuis
 * Paramètres — ni des `sort_order`, réordonnables. Un état de repli qui ne
 * survit pas à un renommage n'a pas d'intérêt.
 *
 * Convention du projet : constante en tête de module, préfixe `epicure_`,
 * JSON avec `try/catch` et valeur de repli. Voir `AuthContext.jsx`,
 * `lib/cache.js`, `lib/syncQueue.js`.
 *
 * @param {string} portee — `'depot'`, `'inventaire'`, `'prelevement'`…
 */
const useOpenSections = (portee) => {
  const cle = PREFIXE + portee;

  // Initialisation paresseuse : lire le stockage à chaque rendu serait
  // gratuit en bogues et coûteux pour rien.
  const [ouvertes, setOuvertes] = useState(() => {
    try {
      const brut = localStorage.getItem(cle);
      return new Set(brut ? JSON.parse(brut) : []);
    } catch {
      // Stockage indisponible (navigation privée) ou JSON abîmé : tout replié,
      // qui est justement le défaut voulu.
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(cle, JSON.stringify([...ouvertes]));
    } catch {
      // Quota plein ou stockage refusé : l'état vit en mémoire pour la session.
      // Perdre une préférence d'affichage ne justifie pas de casser l'écran.
    }
  }, [cle, ouvertes]);

  const isOpen = useCallback((id) => ouvertes.has(id), [ouvertes]);

  const toggle = useCallback((id) => {
    setOuvertes((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const openAll = useCallback((ids) => setOuvertes(new Set(ids)), []);
  const closeAll = useCallback(() => setOuvertes(new Set()), []);

  return { isOpen, toggle, openAll, closeAll, nbOuvertes: ouvertes.size };
};

export default useOpenSections;
