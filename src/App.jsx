import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import { PageLoader } from './components/ui/Spinner';

import Login      from './pages/Login';
import Catalogue  from './pages/Catalogue';
import Depot      from './pages/Depot';
import Inventaire from './pages/Inventaire';
import Parametres from './pages/Parametres';
import Historique from './pages/Historique';

// ── Guard : redirige vers /login si non authentifié ──────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
};

// ── Guard : redirige vers /catalogue si déjà connecté ────────
const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user)    return <Navigate to="/catalogue" replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route
      path="/login"
      element={<GuestRoute><Login /></GuestRoute>}
    />
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/catalogue" replace />} />
      <Route path="catalogue"  element={<Catalogue />} />
      <Route path="depot"      element={<Depot />} />
      <Route path="inventaire" element={<Inventaire />} />
      <Route path="parametres" element={<Parametres />} />
      <Route path="historique" element={<Historique />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
