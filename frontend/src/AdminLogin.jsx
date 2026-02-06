import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const API_URL = 'http://localhost:4000/api';

function AdminLogin() {
    const [email, setEmail] = useState('admin@nitkkr.ac.in');
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
                if (data.user.role !== 'admin') {
                    setError('Access Denied: Not an admin account');
                    return;
                }
                login(data.user, data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                navigate('/admin');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Login failed. Ensure backend is running.');
        }
    };

    return (
        <div className="auth-container admin-login-theme">
            <h2>Admin Portal</h2>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label>Admin Email</label>
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
                <button type="submit" className="admin-btn">Access Dashboard</button>
            </form>
            <div className="auth-footer">
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
                    ← Back to Professor Login
                </a>
            </div>
        </div>
    );
}

export default AdminLogin;
