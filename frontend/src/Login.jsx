import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { login as apiLogin, pingBackend } from './api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('unknown'); // 'unknown' | 'cold' | 'warm'
  const { login, user } = useAuth();
  const { showNotification, dismissByMessage } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/timetable');
    }
  }, [user, navigate]);

  // Ping backend to detect cold start
  useEffect(() => {
    let pingNotifId = null;
    const checkBackend = async () => {
      // Give a 2s delay before showing "warming up" to avoid false alarm on fast loads
      const notifTimer = setTimeout(() => {
        showNotification(
          '🔄 Connecting to server... (first load may take ~20s on free tier)',
          'loading',
          { persistent: true }
        );
        setServerStatus('cold');
      }, 2000);

      const isAlive = await pingBackend();

      clearTimeout(notifTimer);
      dismissByMessage('🔄 Connecting to server... (first load may take ~20s on free tier)');

      if (isAlive) {
        setServerStatus('warm');
      } else {
        setServerStatus('cold');
        showNotification('⚠️ Server is slow to respond. Login may take a moment.', 'warning', { duration: 5000 });
      }
    };

    checkBackend();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiLogin(email, password);
      login(data.user, data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showNotification(`Welcome back, ${data.user.name || data.user.email.split('@')[0]}! 👋`, 'success');

      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/timetable');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
      showNotification(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginBottom:8 }}>
        <img
          src="/logo.png"
          alt="NIT Kurukshetra"
          style={{ width:64, height:64, objectFit:'contain' }}
          onError={e => { e.target.style.display='none'; }}
        />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:800, fontSize:'0.9rem', color:'#1a1a2e', letterSpacing:'0.03em', lineHeight:1.3 }}>NATIONAL INSTITUTE OF TECHNOLOGY</div>
          <div style={{ fontWeight:700, fontSize:'0.78rem', color:'#7c3aed', letterSpacing:'0.05em', lineHeight:1.3 }}>KURUKSHETRA</div>
        </div>
      </div>
      <h2>Sign In</h2>
      <p className="auth-subtitle">Timetable Management System</p>

      {serverStatus === 'cold' && (
        <div className="server-status-banner">
          <span className="status-dot pulsing" />
          Server warming up — login may take up to 20 seconds
        </div>
      )}

      {error && (
        <div className="error">
          <span>⚠️</span>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@nitkkr.ac.in"
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{ paddingRight: '2.8rem' }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="password-toggle"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className={loading ? 'btn-loading' : ''}>
          {loading ? (
            <>
              <span className="btn-spinner" />
              Signing in...
            </>
          ) : 'Sign In'}
        </button>
      </form>

      <div className="auth-footer">
        <p>New Professor? <Link to="/register">Register here</Link></p>
        <div className="separator">or</div>
        <Link to="/admin-login" className="admin-link">Access Admin Portal →</Link>
      </div>
    </div>
  );
}

export default Login;
