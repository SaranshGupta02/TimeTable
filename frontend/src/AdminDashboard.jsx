import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from './NotificationContext';
import * as api from './api';

function AdminDashboard() {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [showAddClass, setShowAddClass] = useState(false);

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Light Theme Constants (matching Timetable.jsx)
    const THEME = {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        textMain: '#0f172a',
        textMuted: '#64748b',
        primary: '#4f46e5',
        border: '#e2e8f0',
        danger: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
    };

    useEffect(() => {
        // Enforce basic auth check
        if (!token || user.role !== 'admin') {
            navigate('/admin-login');
            return;
        }
        // Apply Light Theme Body
        document.body.style.background = THEME.bg;

        // Fetch Data
        Promise.all([fetchUsers(), fetchClasses()]).catch(err => {
            console.error(err);
            if (err.message.includes('Unauthorized')) {
                localStorage.clear();
                navigate('/admin-login');
            }
        });

        return () => { document.body.style.background = ''; };
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (err) { showNotification(err.message, 'error'); }
    };

    const fetchClasses = async () => {
        try {
            const data = await api.getClasses();
            setClasses(data);
        } catch (err) { showNotification(err.message, 'error'); }
    };

    const handleApproval = async (userId, approve) => {
        try {
            await api.approveUser(userId, approve);
            showNotification(approve ? 'Professor Approved' : 'Access Revoked', 'success');
            fetchUsers();
        } catch (err) { showNotification(err.message, 'error'); }
    };

    const logout = () => {
        localStorage.clear();
        navigate('/admin-login');
    };

    const styles = {
        container: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: "'Inter', sans-serif", color: THEME.textMain },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: THEME.cardBg, padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' },
        h1: { margin: 0, fontSize: '1.8rem', fontWeight: '800' },
        section: { marginBottom: '3rem' },
        sectionHeader: { fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: THEME.textMain },
        cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' },
        classCard: { background: THEME.cardBg, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${THEME.border}`, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
        classId: { fontSize: '1.5rem', fontWeight: '800', color: THEME.primary },
        actionBtn: { padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'filter 0.2s' },
        table: { width: '100%', borderCollapse: 'collapse', background: THEME.cardBg, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
        th: { textAlign: 'left', padding: '1rem', background: '#f1f5f9', color: THEME.textMuted, fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700' },
        td: { padding: '1rem', borderTop: `1px solid ${THEME.border}` },
        badge: { padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' },
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.h1}>Admin Dashboard</h1>
                    <p style={{ margin: 0, color: THEME.textMuted }}>Manage classes and professor access</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setShowAddClass(true)} style={{ ...styles.actionBtn, background: THEME.primary, color: 'white' }}>+ Add Class</button>
                    <button onClick={logout} style={{ ...styles.actionBtn, background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.textMuted }}>Logout</button>
                </div>
            </header>

            <section style={styles.section}>
                <div style={styles.sectionHeader}>📚 Manage Classes</div>
                {classes.length === 0 ? <p style={{ color: THEME.textMuted }}>No classes found. Create one to get started.</p> : (
                    <div style={styles.cardGrid}>
                        {classes.map(c => (
                            <div
                                key={c}
                                style={styles.classCard}
                                onClick={() => navigate(`/timetable?classId=${c}&mode=structure`)}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                            >
                                <div style={styles.classId}>{c}</div>
                                <div style={{ color: THEME.textMuted, fontSize: '0.9rem' }}>Click to edit timetable →</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section style={styles.section}>
                <div style={styles.sectionHeader}>👨‍🏫 Professor Approvals</div>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Email</th>
                            <th style={styles.th}>Dept</th>
                            <th style={styles.th}>Status</th>
                            <th style={styles.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id}>
                                <td style={styles.td}><strong>{u.name}</strong></td>
                                <td style={styles.td}>{u.email}</td>
                                <td style={styles.td}><span style={{ background: '#e0e7ff', color: THEME.primary, ...styles.badge }}>{u.department}</span></td>
                                <td style={styles.td}>
                                    <span style={{
                                        ...styles.badge,
                                        background: u.is_approved ? '#dcfce7' : '#fef3c7',
                                        color: u.is_approved ? '#166534' : '#b45309'
                                    }}>
                                        {u.is_approved ? 'Active' : 'Pending'}
                                    </span>
                                </td>
                                <td style={styles.td}>
                                    {!u.is_approved ? (
                                        <button onClick={() => handleApproval(u.id, true)} style={{ ...styles.actionBtn, background: THEME.success, color: 'white', padding: '0.4rem 0.8rem' }}>Approve</button>
                                    ) : (
                                        <button onClick={() => handleApproval(u.id, false)} style={{ ...styles.actionBtn, background: THEME.danger, color: 'white', padding: '0.4rem 0.8rem' }}>Revoke</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: THEME.textMuted }}>No professors registered yet.</p>}
            </section>

            {showAddClass && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ background: 'white', color: THEME.textMain, border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <h3 style={{ marginTop: 0 }}>Add New Class</h3>
                        <AddClassForm onCancel={() => setShowAddClass(false)} onSuccess={() => {
                            setShowAddClass(false);
                            fetchClasses();
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
}

// Re-using AddClassForm logic but ensuring styles match light theme
function AddClassForm({ onCancel, onSuccess }) {
    const { showNotification } = useNotification();
    const [classId, setClassId] = useState('');
    const [periods, setPeriods] = useState(8);
    const [days, setDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    const [timeSlots, setTimeSlots] = useState([]);

    const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    useEffect(() => {
        setTimeSlots(prev => {
            const newSlots = [];
            for (let i = 0; i < periods; i++) {
                if (prev[i]) newSlots.push(prev[i]);
                else newSlots.push(`${i + 9}:00 - ${i + 10}:00`);
            }
            return newSlots;
        });
    }, [periods]);

    const handleTimeChange = (index, value) => {
        const newSlots = [...timeSlots];
        newSlots[index] = value;
        setTimeSlots(newSlots);
    };

    const toggleDay = (day) => {
        setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b)));
    };

    const handleSubmit = async () => {
        if (!classId) return showNotification('Class ID is required', 'warning');
        if (days.length === 0) return showNotification('Select at least one day', 'warning');
        try {
            await api.createClass(classId, days, periods, timeSlots);
            showNotification(`Class ${classId} created`, 'success');
            onSuccess();
        } catch (err) { showNotification(err.message, 'error'); }
    };

    const inputStyle = { width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '1rem', color: '#0f172a' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>Class ID</label>
                <input value={classId} onChange={e => setClassId(e.target.value)} style={inputStyle} placeholder="e.g. E301" autoFocus />
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>Periods: {periods}</label>
                <input type="range" min="4" max="12" value={periods} onChange={e => setPeriods(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>Time Slots</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {timeSlots.map((slot, i) => (
                        <input key={i} value={slot} onChange={e => handleTimeChange(i, e.target.value)} style={{ ...inputStyle, marginBottom: 0, padding: '0.5rem', fontSize: '0.85rem' }} />
                    ))}
                </div>
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>Days</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {ALL_DAYS.map(day => (
                        <button key={day} onClick={() => toggleDay(day)}
                            style={{
                                padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.85rem',
                                background: days.includes(day) ? '#4f46e5' : 'transparent',
                                color: days.includes(day) ? 'white' : '#64748b'
                            }}
                        >{day.slice(0, 3)}</button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={handleSubmit} style={{ flex: 1, padding: '0.8rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Create Class</button>
                <button onClick={onCancel} style={{ flex: 1, padding: '0.8rem', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
            </div>
        </div>
    );
}

export default AdminDashboard;
