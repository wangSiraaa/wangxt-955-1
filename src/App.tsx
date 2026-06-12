import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout.js';
import Login from './pages/Login.js';
import PresaleList from './pages/PresaleList.js';
import PresaleDetail from './pages/PresaleDetail.js';
import CreatePresale from './pages/CreatePresale.js';
import OrderList from './pages/OrderList.js';
import OrderDetail from './pages/OrderDetail.js';
import Pickup from './pages/Pickup.js';
import Notifications from './pages/Notifications.js';
import { useAuthStore } from './store/useAuthStore.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (token) {
    return <Navigate to="/presales" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <Login />
            </RedirectIfAuthenticated>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/presales" replace />} />
          <Route path="presales" element={<PresaleList />} />
          <Route path="presales/:id" element={<PresaleDetail />} />
          <Route path="presales/create" element={<CreatePresale />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="pickup" element={<Pickup />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
