import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Warehouse, ClipboardList, Settings, History, LogOut, CalendarDays, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   perm: 'dashboard.read' },
  { to: '/catalogue',  icon: Package,      label: 'Catalogue',   perm: 'articles.read' },
  { to: '/depot',      icon: Warehouse,    label: 'Dépôt',       perm: 'depot.read' },
  { to: '/inventaire', icon: ClipboardList,label: 'Inventaire',  perm: 'inventory.read' },
  { to: '/evenements', icon: CalendarDays, label: 'Événements',  perm: 'events.read' },
  { to: '/achats',     icon: ShoppingCart,  label: 'Achats',      perm: 'purchases.read' },
  { to: '/historique', icon: History,      label: 'Historique',  perm: 'historique.read' },
  { to: '/parametres', icon: Settings,     label: 'Paramètres',  perm: 'settings.read' },
];

const Sidebar = ({ onClose }) => {
  const { user, logout, can } = useAuth();
  const visible = NAV.filter((n) => can(n.perm));

  return (
    <aside className="flex flex-col h-full bg-primary w-64 text-white">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="font-display text-2xl font-bold tracking-wide">Epicure</h1>
        <p className="text-white/50 text-xs mt-0.5">Gestion du dépôt</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {visible.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 rounded-[var(--radius-md)] mb-1',
                'text-sm font-medium transition-colors duration-150 min-h-[44px]',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-white/50 truncate">{user?.role_name}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors w-full min-h-[44px] px-1"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
