import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('meza_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('meza_token') || null);

  const refreshAuthToken = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Not logged in');
      
      const data = await res.json();
      if (data.token && data.user) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('meza_token', data.token);
        localStorage.setItem('meza_user', JSON.stringify(data.user));
        return true;
      }
      throw new Error('Invalid response');
    } catch (err) {
      if (err.message === 'Failed to fetch' && localStorage.getItem('meza_token')) {
        console.log('Offline: using cached session');
        return true; // Keep cached session
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('meza_token');
        localStorage.removeItem('meza_user');
        return false;
      }
    }
  };

  useEffect(() => {
    // Initial fetch on load
    refreshAuthToken().finally(() => setLoading(false));

    // Setup silent refresh every 10 minutes (600,000 ms) to renew the 15m access token
    const interval = setInterval(() => {
      // Only refresh if we currently think we are logged in
      if (localStorage.getItem('meza_token')) {
        refreshAuthToken();
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const login = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('meza_token', newToken);
    localStorage.setItem('meza_user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch(e) {}
    setToken(null);
    setUser(null);
    localStorage.removeItem('meza_token');
    localStorage.removeItem('meza_user');
  };

  const updateUser = (newUserData) => {
    setUser(newUserData);
    if (newUserData) localStorage.setItem('meza_user', JSON.stringify(newUserData));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
