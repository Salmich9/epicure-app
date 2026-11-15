import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { verifyPin, sessionValide, fermerSession } from '../data/auth';
import { JETON_KEY, lireJeton } from '../lib/supabase';
import { fetchAllPermissions, hasPermission } from '../data/permissions';

const SESSION_KEY = 'epicure_session';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);          // { id, full_name, role_id, role_name }
  const [permissions, setPermissions] = useState([]);            // toutes les permissions
  const [loading, setLoading]         = useState(true);          // init

  const oublier = () => {
    setUser(null);
    setPermissions([]);
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(JETON_KEY); } catch { /* stockage indisponible */ }
  };

  // Restaure la session depuis localStorage, si le serveur la reconnaît encore.
  // Sans jeton (ancienne connexion) ou jeton expiré : retour au PIN.
  useEffect(() => {
    let raw = null;
    try { raw = localStorage.getItem(SESSION_KEY); } catch { /* stockage indisponible */ }
    if (!raw || !lireJeton()) { oublier(); setLoading(false); return; }
    try {
      const session = JSON.parse(raw);
      setUser(session.user);
      setPermissions(session.permissions ?? []);
    } catch { oublier(); setLoading(false); return; }
    setLoading(false);
    // Vérification en ligne ; hors connexion on garde la session (file d'attente hors-ligne)
    sessionValide().then((ok) => { if (!ok) oublier(); }).catch(() => {});
  }, []);

  const login = useCallback(async (pin) => {
    const userData = await verifyPin(pin);
    if (userData?.erreur === 'bloque') throw new Error('Trop d\'essais : réessayez dans 15 minutes.');
    if (!userData) throw new Error('PIN incorrect');
    const { session: jeton, ...infos } = userData;
    try { localStorage.setItem(JETON_KEY, jeton || ''); } catch { /* stockage indisponible */ }
    const perms = await fetchAllPermissions();
    setUser(infos);
    setPermissions(perms);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: infos, permissions: perms }));
    return infos;
  }, []);

  const logout = useCallback(() => {
    fermerSession().catch(() => {});
    oublier();
  }, []);

  // Vérifie une permission pour l'utilisateur courant (lit depuis les perms en mémoire)
  const can = useCallback(
    (key) => {
      if (!user) return false;
      return hasPermission(permissions, user.role_id, key);
    },
    [user, permissions]
  );

  // Recharge les permissions (utile après modification par super_admin)
  const reloadPermissions = useCallback(async () => {
    const perms = await fetchAllPermissions();
    setPermissions(perms);
    if (user) {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        session.permissions = perms;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, can, reloadPermissions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
