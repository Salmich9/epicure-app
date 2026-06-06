import { useState, useEffect } from 'react';

/**
 * Détecte l'état de connexion réseau.
 * Retourne true si en ligne, false si hors-ligne.
 */
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return isOnline;
};

export default useOnlineStatus;
