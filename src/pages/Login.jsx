import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const KEYS = ['1','2','3','4','5','6','7','8','9','←','0','✓'];

const Login = () => {
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleKey = async (k) => {
    if (loading) return;
    setError('');

    if (k === '←') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (k === '✓') {
      if (pin.length < 4) { setError('PIN trop court'); return; }
      setLoading(true);
      try {
        await login(pin);
        // Le depot est l ecran de travail : c est la qu on arrive.
        navigate('/depot', { replace: true });
      } catch (e) {
        setError('PIN incorrect. Réessayez.');
        setPin('');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (pin.length >= 8) return;
    setPin((p) => p + k);
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl font-bold text-white tracking-wide">Epicure</h1>
          <p className="text-white/50 mt-1 text-sm">Gestion du dépôt</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[var(--radius-lg)] shadow-xl p-6">
          <h2 className="font-display text-xl font-semibold text-center text-[var(--color-text)] mb-5">
            Saisir votre PIN
          </h2>

          {/* Affichage PIN */}
          <div className="flex items-center justify-center gap-3 mb-5 h-12">
            {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'w-4 h-4 rounded-full border-2 transition-colors duration-150',
                  i < pin.length
                    ? 'bg-primary border-primary'
                    : 'bg-transparent border-[var(--color-border)]'
                )}
              />
            ))}
          </div>

          {/* Message d'erreur */}
          {error && (
            <p className="text-center text-sm text-red-500 mb-3 animate-pulse">{error}</p>
          )}

          {/* Clavier numérique */}
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((k) => {
              const isConfirm = k === '✓';
              const isDelete  = k === '←';
              return (
                <button
                  key={k}
                  onClick={() => handleKey(k)}
                  disabled={loading}
                  className={cn(
                    'h-16 rounded-[var(--radius-md)] text-xl font-medium transition-all duration-150',
                    'flex items-center justify-center select-none active:scale-95',
                    'disabled:opacity-50',
                    isConfirm
                      ? 'bg-primary text-white hover:bg-primary-600'
                      : isDelete
                      ? 'bg-warm-100 text-[var(--color-text-muted)] hover:bg-warm-200'
                      : 'bg-warm-50 text-[var(--color-text)] hover:bg-warm-100 border border-[var(--color-border)]'
                  )}
                  aria-label={isDelete ? 'Effacer' : isConfirm ? 'Valider' : k}
                >
                  {isDelete ? <Delete size={20} /> : k}
                </button>
              );
            })}
          </div>

          {loading && (
            <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
              Connexion…
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
