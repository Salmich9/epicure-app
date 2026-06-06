import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { verifyPin } from '../data/auth';
import { fetchAllPermissions, hasPermission } from '../data/permissions';

const SESSION_KEY = 'epicure_session';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);          // { id, full_name, role_id, role_name }
  const [permissions, setPermissions] = useState([]);            // toutes les permissions
  const [loading, setLoading]         = useState(true);          // init

  // Restaure la session depuis localStorage
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const session = JSON.parse(raw);
        setUser(session.user);
        setPermissions(session.permissions ?? []);
      } catch { localStorage.removeItem(SESSION_KEY); }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (pin) => {
    const userData = await verifyPin(pin);
    if (!userData) throw new Error('PIN incorrect');
    const perms = await fetchAllPermissions();
    setUser(userData);
    setPermissions(perms);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: userData, permissions: perms }));
    return userData;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setPermissions([]);
    localStorage.removeItem(SESSION_KEY);
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
