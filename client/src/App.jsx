import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLogin from './pages/AdminLogin';
import MerchantLogin from './pages/MerchantLogin';
import AdminDashboard from './pages/AdminDashboard';
import MerchantDashboard from './pages/MerchantDashboard';
import ScratchCard from './pages/ScratchCard';
import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Auth Routes (public) */}
            <Route path="/login/admin" element={<AdminLogin />} />
            <Route path="/login/merchant" element={<MerchantLogin />} />

            {/* Protected Dashboard Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin" redirectTo="/login/admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/merchant"
              element={
                <ProtectedRoute requiredRole="merchant" redirectTo="/login/merchant">
                  <MerchantDashboard />
                </ProtectedRoute>
              }
            />

            {/* Public Coupon Route (no auth needed) */}
            <Route path="/coupon/:uuid" element={<ScratchCard />} />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login/merchant" replace />} />
            <Route path="*" element={<Navigate to="/login/merchant" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
