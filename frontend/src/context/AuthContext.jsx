import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('meza_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('meza_token') || null);

  useEffect(() => {
    // Attempt to authenticate via httpOnly cookie on app load
    fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then(data => {
        if (data.token && data.user) {
          setToken(data.token);
          setUser(data.user);
          localStorage.setItem('meza_token', data.token);
          localStorage.setItem('meza_user', JSON.stringify(data.user));
        } else {
          throw new Error('Invalid response');
        }
      })
      .catch((err) => {
        // If network error (offline), and we already have a token in localStorage, keep it!
        if (err.message === 'Failed to fetch' && localStorage.getItem('meza_token')) {
          console.log('Offline: using cached session');
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('meza_token');
          localStorage.removeItem('meza_user');
        }
      })
      .finally(() => setLoading(false));
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
