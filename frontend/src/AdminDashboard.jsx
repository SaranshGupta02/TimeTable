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
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [profSearch, setProfSearch] = useState('');
  const [stats, setStats] = useState(null);

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const THEME = {
    bg: '#f8fafc', cardBg: '#ffffff', textMain: '#0f172a', textMuted: '#64748b',
    primary: '#4f46e5', border: '#e2e8f0', danger: '#ef4444', success: '#10b981', warning: '#f59e0b',
  };

  useEffect(() => {
    if (!token || user.role !== 'admin') {
      navigate('/admin-login');
      return;
    }
    document.body.style.background = THEME.bg;
    fetchAll();
    return () => { document.body.style.background = ''; };
  }, []);

  const fetchAll = async () => {
    await Promise.all([fetchUsers(), fetchClasses(), fetchStats()]);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      showNotification(err.message, 'error');
      if (err.message.includes('Unauthorized')) { localStorage.clear(); navigate('/admin-login'); }
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const data = await api.getClasses();
      setClasses(data);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch {
      /* stats are optional */
    }
  };

  const handleApproval = async (userId, approve) => {
    try {
      await api.approveUser(userId, approve);
      showNotification(approve ? '✅ Professor Approved' : '🚫 Access Revoked', approve ? 'success' : 'warning');
      fetchUsers();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const handleDeleteClass = async (e, classId) => {
    e.stopPropagation();
    if (!window.confirm(`Delete Class ${classId}?\nAll timetable data will be permanently deleted.`)) return;
    try {
      await api.deleteClass(classId);
      showNotification(`Class ${classId} deleted`, 'success');
      fetchClasses();
      fetchStats();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = '/admin-login';
  };

  const pendingCount = users.filter(u => !u.is_approved).length;
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(profSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(profSearch.toLowerCase()) ||
    u.department?.toLowerCase().includes(profSearch.toLowerCase())
  );

  const s = {
    container: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: "'Inter', sans-serif", color: THEME.textMain },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: THEME.cardBg, padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' },
    section: { marginBottom: '3rem' },
    sectionHeader: { fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: THEME.textMain },
    cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.2rem' },
    classCard: { background: THEME.cardBg, borderRadius: '12px', padding: '1.3rem', border: `1px solid ${THEME.border}`, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.4rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative' },
    classId: { fontSize: '1.4rem', fontWeight: '800', color: THEME.primary },
    deleteBtn: { position: 'absolute', top: '0.8rem', right: '0.8rem', background: '#fee2e2', color: THEME.danger, border: 'none', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' },
    actionBtn: { padding: '0.55rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', transition: 'filter 0.2s' },
    table: { width: '100%', borderCollapse: 'collapse', background: THEME.cardBg, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    th: { textAlign: 'left', padding: '1rem', background: '#f1f5f9', color: THEME.textMuted, fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.03em' },
    td: { padding: '1rem', borderTop: `1px solid ${THEME.border}`, fontSize: '0.9rem' },
    badge: { padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' },
  };

  return (
    <div style={s.container}>
      {/* ---- HEADER ---- */}
      <header style={s.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: '800' }}>🛠️ Admin Dashboard</h1>
          <p style={{ margin: 0, color: THEME.textMuted, marginTop: '0.2rem' }}>Manage classes and professor access</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddClass(true)} style={{ ...s.actionBtn, background: THEME.primary, color: 'white' }}>
            + Add Class
          </button>
          <button
            onClick={() => navigate('/timetable')}
            style={{ ...s.actionBtn, background: '#e0e7ff', color: THEME.primary, border: `1px solid ${THEME.primary}20` }}
          >
            📅 View Timetable
          </button>
          <button onClick={logout} style={{ ...s.actionBtn, background: 'transparent', border: `1px solid ${THEME.border}`, color: THEME.textMuted }}>
            Logout
          </button>
        </div>
      </header>

      {/* ---- STAT TILES ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total Classes', value: classes.length, icon: '📚', color: THEME.primary, bg: '#e0e7ff' },
          { label: 'Professors', value: users.length, icon: '👨‍🏫', color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Pending Approval', value: pendingCount, icon: '⏳', color: pendingCount > 0 ? THEME.warning : THEME.success, bg: pendingCount > 0 ? '#fef3c7' : '#dcfce7' },
          { label: 'Fill Rate', value: stats ? `${stats.overall.pct}%` : '—', icon: '📊', color: '#0891b2', bg: '#e0f2fe' },
        ].map((tile, i) => (
          <div key={i} style={{ background: THEME.cardBg, padding: '1.2rem', borderRadius: '12px', border: `1px solid ${THEME.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{tile.icon}</div>
            <div style={{ fontSize: '1.7rem', fontWeight: '800', color: tile.color }}>{tile.value}</div>
            <div style={{ fontSize: '0.78rem', color: THEME.textMuted, fontWeight: '600', marginTop: '0.2rem' }}>{tile.label}</div>
          </div>
        ))}
      </div>

      {/* ---- CLASSES ---- */}
      <section style={s.section}>
        <div style={s.sectionHeader}>📚 Manage Classes</div>
        {loadingClasses ? (
          <div style={s.cardGrid}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '12px' }} />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p style={{ color: THEME.textMuted, padding: '2rem', textAlign: 'center' }}>No classes found. Create one to get started.</p>
        ) : (
          <div style={s.cardGrid}>
            {classes.map(c => {
              const classStats = stats?.byClass?.find(s => s.classId === c);
              return (
                <div
                  key={c}
                  style={s.classCard}
                  onClick={() => navigate(`/timetable?classId=${c}&mode=structure`)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                >
                  <div style={s.classId}>{c}</div>
                  {classStats && (
                    <>
                      <div style={{ fontSize: '0.8rem', color: THEME.textMuted }}>{classStats.filled}/{classStats.total} slots filled</div>
                      <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '99px', marginTop: '4px' }}>
                        <div style={{ width: `${classStats.pct}%`, height: '100%', borderRadius: '99px', background: classStats.pct >= 70 ? THEME.success : classStats.pct >= 30 ? THEME.warning : THEME.danger, transition: 'width 0.5s' }} />
                      </div>
                    </>
                  )}
                  {!classStats && <div style={{ color: THEME.textMuted, fontSize: '0.85rem' }}>Click to edit timetable →</div>}
                  <button onClick={(e) => handleDeleteClass(e, c)} style={s.deleteBtn} title="Delete">🗑️</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- PROFESSORS ---- */}
      <section style={s.section}>
        <div style={{ ...s.sectionHeader, justifyContent: 'space-between' }}>
          <span>👨‍🏫 Professor Approvals</span>
          <input
            type="text"
            placeholder="Search by name, email, dept..."
            value={profSearch}
            onChange={e => setProfSearch(e.target.value)}
            style={{
              padding: '0.5rem 0.9rem', border: `1px solid ${THEME.border}`, borderRadius: '8px',
              fontSize: '0.85rem', color: THEME.textMain, background: THEME.cardBg, width: '240px',
              outline: 'none',
            }}
          />
        </div>

        {loadingUsers ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '6px', marginBottom: '4px' }} />
            ))}
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Dept', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: THEME.textMuted, padding: '2rem' }}>
                  {profSearch ? `No professors matching "${profSearch}"` : 'No professors registered yet.'}
                </td></tr>
              ) : filteredUsers.map(u => (
                <tr key={u.id}>
                  <td style={s.td}><strong>{u.name}</strong></td>
                  <td style={{ ...s.td, color: THEME.textMuted, fontSize: '0.85rem' }}>{u.email}</td>
                  <td style={s.td}>
                    <span style={{ background: '#e0e7ff', color: THEME.primary, ...s.badge }}>{u.department}</span>
                  </td>
                  <td style={{ ...s.td, color: THEME.textMuted, fontSize: '0.82rem' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.badge,
                      background: u.is_approved ? '#dcfce7' : '#fef3c7',
                      color: u.is_approved ? '#166534' : '#b45309'
                    }}>
                      {u.is_approved ? '● Active' : '● Pending'}
                    </span>
                  </td>
                  <td style={s.td}>
                    {!u.is_approved ? (
                      <button onClick={() => handleApproval(u.id, true)} style={{ ...s.actionBtn, background: THEME.success, color: 'white', padding: '0.35rem 0.75rem' }}>
                        Approve
                      </button>
                    ) : (
                      <button onClick={() => handleApproval(u.id, false)} style={{ ...s.actionBtn, background: '#fee2e2', color: THEME.danger, padding: '0.35rem 0.75rem' }}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---- ADD CLASS MODAL ---- */}
      {showAddClass && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: 'white', color: THEME.textMain, border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>➕ Add New Class</h3>
            <AddClassForm
              onCancel={() => setShowAddClass(false)}
              onSuccess={() => {
                setShowAddClass(false);
                fetchClasses();
                fetchStats();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AddClassForm({ onCancel, onSuccess }) {
  const { showNotification } = useNotification();
  const [classId, setClassId] = useState('');
  const [periods, setPeriods] = useState(8);
  const [days, setDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    setTimeSlots(prev => {
      const newSlots = [];
      for (let i = 0; i < periods; i++) {
        newSlots.push(prev[i] || `${i + 9}:00 - ${i + 10}:00`);
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
    setDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
    );
  };

  const handleSubmit = async () => {
    if (!classId.trim()) return showNotification('Class ID is required', 'warning');
    if (days.length === 0) return showNotification('Select at least one day', 'warning');
    setLoading(true);
    try {
      await api.createClass(classId.trim().toUpperCase(), days, periods, timeSlots);
      showNotification(`Class ${classId.toUpperCase()} created ✓`, 'success');
      onSuccess();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '0.9rem', color: '#0f172a', boxSizing: 'border-box', fontSize: '0.9rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh', overflowY: 'auto' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Class ID</label>
        <input value={classId} onChange={e => setClassId(e.target.value)} style={inputStyle} placeholder="e.g. E301" autoFocus />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Periods: <strong>{periods}</strong></label>
        <input type="range" min="1" max="12" value={periods} onChange={e => setPeriods(Number(e.target.value))} style={{ width: '100%', marginBottom: '0.9rem' }} />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Time Slots</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.9rem' }}>
          {timeSlots.map((slot, i) => (
            <input key={i} value={slot} onChange={e => handleTimeChange(i, e.target.value)} style={{ ...inputStyle, marginBottom: 0, padding: '0.5rem', fontSize: '0.82rem' }} />
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Days</label>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          {ALL_DAYS.map(day => (
            <button key={day} onClick={() => toggleDay(day)}
              style={{
                padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.82rem',
                background: days.includes(day) ? '#4f46e5' : 'transparent',
                color: days.includes(day) ? 'white' : '#64748b',
                fontWeight: days.includes(day) ? '700' : '500'
              }}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ flex: 1, padding: '0.8rem', background: loading ? '#6366f1' : '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          {loading ? <><span className="btn-spinner" /> Creating...</> : 'Create Class'}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: '0.8rem', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;
