import { useAuth } from '../contexts/AuthContext';

/**
 * Vérifie si l'utilisateur courant possède une (ou plusieurs) permissions.
 * Lit toujours depuis la table en mémoire (chargée à la connexion).
 *
 * @param  {string|string[]} key  Clé(s) de permission
 * @returns {boolean}
 */
const usePermission = (key) => {
  const { can } = useAuth();
  if (Array.isArray(key)) return key.every((k) => can(k));
  return can(key);
};

export default usePermission;
