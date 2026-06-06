/**
 * Cache localStorage simple pour le mode hors-ligne.
 * Utilisé par la couche data/ pour servir des données
 * stale quand Supabase est inaccessible.
 */

const PREFIX = 'epicure_cache_';

export const setCache = (key, data, ttlMs = 5 * 60 * 1000) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({
      data,
      expires: Date.now() + ttlMs,
    }));
  } catch { /* localStorage plein — on ignore */ }
};

export const getCache = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return data;
  } catch { return null; }
};

/**
 * Stale-While-Revalidate :
 * - Si cache frais → retourne immédiatement
 * - Si cache périmé ou absent → fetch, met à jour le cache
 * - Si fetch échoue et cache disponible (même périmé) → retourne le stale
 */
export const withCache = async (key, fetcher, ttlMs) => {
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const data = await fetcher();
    setCache(key, data, ttlMs);
    return data;
  } catch (err) {
    // Tente le stale (sans vérification TTL)
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) return JSON.parse(raw).data;
    } catch {}
    throw err;
  }
};

export const invalidateCache = (key) => {
  localStorage.removeItem(PREFIX + key);
};
