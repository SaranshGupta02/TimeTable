import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = 'http://localhost:4000/api';

function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        department: 'CSE'
    });
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');

    const departments = ['CSE', 'ECE', 'MECH', 'MATH', 'PHYSICS'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.email.endsWith('@nitkkr.ac.in')) {
            setError('Email must be @nitkkr.ac.in');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (res.ok) {
                setMsg(data.message);
                setError('');
                setTimeout(() => navigate('/'), 3000);
            } else {
                setError(data.error);
                setMsg('');
            }
        } catch (err) {
            setError('Registration failed');
        }
    };

    return (
        <div className="auth-container">
            <h2>Professor Registration</h2>
            {error && <div className="error">{error}</div>}
            {msg && <div className="success">{msg}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Name</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Email (@nitkkr.ac.in)</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Password</label>
                    <input
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Department</label>
                    <select
                        value={formData.department}
                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                    >
                        {departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
                <button type="submit">Register</button>
            </form>
            <div className="auth-footer">
                Already have an account? <Link to="/">Login here</Link>
            </div>
        </div>
    );
}

export default Register;
