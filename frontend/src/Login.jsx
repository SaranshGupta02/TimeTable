import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

const API_URL = 'http://localhost:4000/api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        login(data.user, data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/timetable');
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Login failed. Ensure backend is running.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Timetable Login</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <div className="auth-footer">
        <p>New Professor? <Link to="/register">Register here</Link></p>
        <div className="separator">or</div>
        <Link to="/admin-login" className="admin-link">Access Admin Portal</Link>
      </div>
    </div>
  );
}

export default Login;
