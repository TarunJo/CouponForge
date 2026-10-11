import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function MerchantLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, logout, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Clear any existing session when visiting login page
  useEffect(() => {
    if (user && user.role !== 'merchant') {
      logout();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[MerchantLogin] Submitting login for:', email);
    setLoading(true);
    try {
      const result = await login('merchant/login', { email, password });
      console.log('[MerchantLogin] Login success:', result);
      toast.success('Welcome back!');
      navigate('/merchant');
    } catch (err) {
      console.error('[MerchantLogin] Login error:', err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card animate-in">
        <div className="auth-logo">
          <div className="logo-icon">🏪</div>
          <h1>CouponForge</h1>
        </div>
        <p className="auth-subtitle">Merchant Dashboard</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="merchant-email"
              type="email"
              className="form-input"
              placeholder="merchant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="merchant-password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            id="merchant-login-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? '⏳ Signing in...' : '🏪 Sign In as Merchant'}
          </button>
        </form>

        <div className="auth-footer">
          Are you an admin? <Link to="/login/admin">Sign in here →</Link>
        </div>
      </div>
    </div>
  );
}
