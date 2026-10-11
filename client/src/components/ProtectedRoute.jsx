import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — Prevents unauthenticated access and back-button bypass.
 * 
 * Security features:
 * - Redirects to login if no valid session exists
 * - Validates user role matches the required role
 * - Pushes replaceState to prevent back-button returning to protected pages after logout
 * - Shows nothing while checking auth (no flash of protected content)
 */
export default function ProtectedRoute({ children, requiredRole, redirectTo }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // No user session — redirect to login
      navigate(redirectTo, { replace: true });
      return;
    }

    if (requiredRole && user.role !== requiredRole) {
      // User doesn't have the right role
      const loginPath = user.role === 'admin' ? '/login/admin' : '/login/merchant';
      navigate(loginPath, { replace: true });
      return;
    }

    // Prevent back-button from showing this page after logout:
    // Replace the current history entry so there's nothing to "go back" to
    const handlePopState = () => {
      if (!localStorage.getItem('coupon_token')) {
        navigate(redirectTo, { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, loading, requiredRole, redirectTo, navigate]);

  // Don't render anything while checking auth or if unauthorized
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user || (requiredRole && user.role !== requiredRole)) {
    return null;
  }

  return children;
}
