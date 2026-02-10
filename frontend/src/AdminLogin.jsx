import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { login as apiLogin } from './api';

function AdminLogin() {
    const [email, setEmail] = useState('admin@nitkkr.ac.in');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, user } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (user?.role === 'admin') {
            navigate('/admin', { replace: true });
        }
    }, [user, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const data = await apiLogin(email, password);

            if (data.user.role !== 'admin') {
                setError('Access Denied: Not an admin account');
                return;
            }
            login(data.user, data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/admin', { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed. Ensure backend is running.');
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
                <Link to="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: '500' }}>
                    ← Back to Professor Login
                </Link>
            </div>
        </div>
    );
}

export default AdminLogin;
