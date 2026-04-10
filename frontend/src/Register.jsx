import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from './api';
import { useNotification } from './NotificationContext';

function Register() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: 'CSE'
  });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const departments = ['CSE', 'ECE', 'MECH', 'MATH', 'PHYSICS'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.endsWith('@nitkkr.ac.in')) {
      setError('Email must end with @nitkkr.ac.in');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await register(formData);
      setMsg(data.message);
      showNotification('Registration successful! Awaiting admin approval.', 'success');
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message || 'Registration failed');
      showNotification(err.message || 'Registration failed', 'error');
      setMsg('');
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
      <h2>Register</h2>
      <p className="auth-subtitle">Professor Account Registration</p>

      {/* Back navigation */}
      <button
        onClick={() => navigate('/')}
        style={{
          alignSelf: 'flex-start', background: 'none', border: 'none', color: '#64748b',
          cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', padding: '0',
          display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '-0.5rem'
        }}
      >
        ← Back to Login
      </button>

      {error && <div className="error"><span>⚠️</span> {error}</div>}
      {msg && <div className="success">✅ {msg}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Dr. Rajesh Sharma"
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label>Email (@nitkkr.ac.in)</label>
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="name@nitkkr.ac.in"
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min. 6 characters"
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label>Department</label>
          <select
            value={formData.department}
            onChange={e => setFormData({ ...formData, department: e.target.value })}
            disabled={loading}
          >
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading} className={loading ? 'btn-loading' : ''}>
          {loading ? (
            <><span className="btn-spinner" /> Registering...</>
          ) : 'Create Account'}
        </button>
      </form>

      <div className="auth-footer">
        Already have an account? <Link to="/">Login here</Link>
      </div>
    </div>
  );
}

export default Register;
