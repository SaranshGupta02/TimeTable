import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { login as apiLogin } from './api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function AdminLogin() {
  const [email, setEmail] = useState('admin@nitkkr.ac.in');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      if (data.user.role !== 'admin') {
        setError('Access Denied: Not an admin account');
        setLoading(false);
        return;
      }
      login(data.user, data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showNotification('Welcome, Admin! 🛠️', 'success');
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Login failed.');
      showNotification(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container admin-login-theme">
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
      <h2>Admin Portal</h2>
      <p className="auth-subtitle">Restricted Access · Timetable System</p>

      {error && <div className="error"><span>⚠️</span> {error}</div>}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Admin Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

        <button type="submit" className={`admin-btn ${loading ? 'btn-loading' : ''}`} disabled={loading}>
          {loading ? (
            <><span className="btn-spinner" /> Authenticating...</>
          ) : 'Access Dashboard'}
        </button>
      </form>

      <div className="auth-footer">
        <Link
          to="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', color: '#64748b', fontWeight: '600', fontSize: '0.88rem', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', transition: 'all 0.15s' }}
        >
          ← Professor Login
        </Link>
      </div>
    </div>
  );
}

export default AdminLogin;
