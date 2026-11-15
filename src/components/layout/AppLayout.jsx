import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Le tiroir n'avait ni Echap ni blocage du defilement, alors que `Modal` a
  // les deux depuis toujours. Sur iOS, le fond defilait sous le tiroir ouvert.
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handler);
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-full bg-[var(--color-bg)]">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar mobile (drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
          {/* Un bouton fermer visible. L'icone `X` etait importee depuis
              toujours et jamais posee — le tiroir ne se fermait que par le
              fond ou par un lien de navigation. */}
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="relative z-50 m-3 min-h-touch min-w-touch flex items-center justify-center rounded-[var(--radius-md)] bg-white/90 text-[var(--color-text)] shadow-md self-start"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Main */}
      {/* Pas d'`overflow-hidden` ici : il rendait TOUT debordement
          horizontal definitivement invisible et injoignable au doigt,
          dans toute l'app. Chaque conteneur de table porte desormais son
          propre `overflow-x-auto` — c'est la qu'un debordement se
          rattrape, pas au niveau du layout. */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar mobile */}
        <header className="no-print lg:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-[var(--color-border)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-warm-100 text-[var(--color-text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
          <h1 className="font-display text-xl font-semibold text-primary">Epicure</h1>
          <div className="w-11" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
