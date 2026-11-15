import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Warehouse, ClipboardList, Settings, History, LogOut, CalendarDays, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   perm: 'dashboard.read' },
  { to: '/depot',      icon: Warehouse,    label: 'Dépôt',       perm: 'depot.read' },
  { to: '/inventaire', icon: ClipboardList,label: 'Inventaire',  perm: 'inventory.read' },
  { to: '/evenements', icon: CalendarDays, label: 'Événements',  perm: 'events.read' },
  { to: '/historique', icon: History,      label: 'Historique',  perm: 'historique.read' },
  { to: '/parametres', icon: Settings,     label: 'Paramètres',  perm: 'settings.read' },
];

const Sidebar = ({ onClose }) => {
  const { user, logout, can } = useAuth();
  const visible = NAV.filter((n) => can(n.perm));

  return (
    <aside className="flex flex-col h-full bg-primary w-64 text-white">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{background:'linear-gradient(145deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 100%)'}}>
          <svg width="22" height="22" viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 32L34 14L62 32V58H6V32Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinejoin="round"/>
            <path d="M6 32L34 14L62 32" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinejoin="round"/>
            <rect x="24" y="38" width="20" height="20" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" strokeWidth="2"/>
            <path d="M34 54V42M34 42L29 47M34 42L39 47" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="34" cy="14" r="2.5" fill="rgba(255,255,255,0.7)"/>
          </svg>
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide leading-none">Epicure</h1>
          <p className="text-white/50 text-xs mt-0.5">Gestion du dépôt</p>
        </div>
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
