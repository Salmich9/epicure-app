import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes. ' +
    'Copie .env.example en .env et remplis les valeurs.'
  );
}

// Jeton de session ouvert par le PIN : envoyé avec chaque requête, la base refuse tout sans lui.
export const JETON_KEY = 'epicure_jeton';
export const lireJeton = () => { try { return localStorage.getItem(JETON_KEY); } catch { return null; } };

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },   // On gère la session manuellement (PIN)
  global: {
    fetch: (url, options = {}) => {
      const jeton = lireJeton();
      if (!jeton) return fetch(url, options);
      const headers = new Headers(options.headers);
      headers.set('x-depot-session', jeton);
      return fetch(url, { ...options, headers });
    },
  },
});
