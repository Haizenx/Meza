import re

with open('/Users/apple/Meza/frontend/src/context/AuthContext.jsx', 'r') as f:
    content = f.read()

old_effect = """  useEffect(() => {
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
  }, []);"""

new_effect = """  const refreshAuthToken = async () => {
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
  }, []);"""

content = content.replace(old_effect, new_effect, 1)

with open('/Users/apple/Meza/frontend/src/context/AuthContext.jsx', 'w') as f:
    f.write(content)

