import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import MenuManagement from './pages/admin/MenuManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import RecipeCalculator from './pages/admin/RecipeCalculator';
import CashierMode from './pages/cashier/CashierMode';
import Login from './pages/Login';
import StaffManagement from './pages/admin/StaffManagement';
import ShiftHistory from './pages/admin/ShiftHistory';
import SystemSettings from './pages/admin/SystemSettings';
import KitchenDisplay from './pages/kds/KitchenDisplay';
import QRMenu from './pages/customer/QRMenu';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Public Customer App */}
      <Route path="/table/:tableNumber" element={<QRMenu />} />
      
      {/* Cashier Mode - Full Screen */}
      <Route 
        path="/cashier" 
        element={
          <ProtectedRoute allowedRoles={['cashier', 'owner', 'manager']}>
            <CashierMode />
          </ProtectedRoute>
        } 
      />

      {/* Kitchen Display System - Full Screen */}
      <Route 
        path="/kds" 
        element={
          <ProtectedRoute allowedRoles={['cashier', 'owner', 'manager']}>
            <KitchenDisplay />
          </ProtectedRoute>
        } 
      />

      {/* Admin Platform */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="menu" element={<MenuManagement />} />
        <Route path="inventory" element={<InventoryManagement />} />
        <Route path="calculator" element={<RecipeCalculator />} />
        <Route path="staff" element={<StaffManagement />} />
        <Route path="shifts" element={<ShiftHistory />} />
        <Route path="settings" element={<SystemSettings />} />
        {/* Mocks for other sidebar links */}
        <Route path="*" element={<div className="p-8 text-meza-muted">Under Construction</div>} />
      </Route>

      {/* Redirect root based on role */}
      <Route 
        path="/" 
        element={
          user ? (
            user.role === 'cashier' ? <Navigate to="/cashier" replace /> : <Navigate to="/admin" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
