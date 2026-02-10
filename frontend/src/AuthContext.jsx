import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    const ts = localStorage.getItem('loginTimestamp');

    // Check if session is older than 8 hours (8 * 60 * 60 * 1000 ms)
    const EIGHT_HOURS = 8 * 60 * 60 * 1000;
    if (u && t && ts && (Date.now() - parseInt(ts) < EIGHT_HOURS)) {
      return { ...JSON.parse(u), token: t };
    }

    // Cleanup expired session
    localStorage.clear();
    return null;
  });

  const login = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('loginTimestamp', Date.now().toString());
    setUser({ ...userData, token });
  }, []);

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
    window.location.href = '/'; // Redirect to home/login
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
