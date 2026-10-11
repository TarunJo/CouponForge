import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_BASE = '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('coupon_token');
    const savedUser = localStorage.getItem('coupon_user');
    if (savedToken && savedUser) {
      try {
        // Validate token hasn't expired client-side
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } else {
          // Token expired, clear it
          localStorage.removeItem('coupon_token');
          localStorage.removeItem('coupon_user');
        }
      } catch (e) {
        // Invalid token, clear it
        localStorage.removeItem('coupon_token');
        localStorage.removeItem('coupon_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (endpoint, credentials) => {
    const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('coupon_token', data.token);
    localStorage.setItem('coupon_user', JSON.stringify(data.user));
    return data;
  }, []);

  const logout = useCallback(async () => {
    // Blacklist the token server-side so it can't be reused
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (e) {
        // Logout API failed, still clear locally
        console.warn('Server logout failed:', e);
      }
    }

    setToken(null);
    setUser(null);
    localStorage.removeItem('coupon_token');
    localStorage.removeItem('coupon_user');

    // Clear any cached pages from browser history
    // This prevents back-button showing authenticated pages
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.href);
    }
  }, [token]);

  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    const data = await res.json();

    if (res.status === 403 || res.status === 401) {
      // Token revoked or expired — force logout
      setToken(null);
      setUser(null);
      localStorage.removeItem('coupon_token');
      localStorage.removeItem('coupon_user');
      throw new Error('Session expired. Please login again.');
    }

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export { API_BASE };
