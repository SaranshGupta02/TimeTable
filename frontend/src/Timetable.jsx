import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { getClasses, getTimetable, updateSlot } from './api';

export default function Timetable() {
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [editVal, setEditVal] = useState(''); // Used for Subject OR Department

  const isAdmin = user?.role === 'admin';
  const isApproved = user?.is_approved === 1 || isAdmin;

  // Departments for Admin Dropdown
  const DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'MATH', 'PHYSICS', 'Common'];

  useEffect(() => {
    getClasses().then(setClasses).catch(e => showNotification(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!classId) { setData(null); return; }
    setLoading(true);
    // Updates URL processing
    setSearchParams({ classId });

    getTimetable(classId).then(setData).catch(e => showNotification(e.message, 'error')).finally(() => setLoading(false));
  }, [classId]);

  async function saveSlot() {
    if (editing == null) return;
    const [periodIndex, dayIndex] = editing;
    try {
      // If Admin: Update Department. If Prof: Update Subject
      const subject = isAdmin ? '' : editVal;
      const department = isAdmin ? editVal : null;

      await updateSlot(classId, dayIndex, periodIndex, subject, department);

      setData(prev => {
        const next = {
          ...prev, grid: prev.grid.map((row, pi) => pi === periodIndex ? row.map((cell, di) => {
            if (di === dayIndex) {
              return isAdmin ? { ...cell, department: editVal } : { ...cell, subject: editVal };
            }
            return cell;
          }) : row)
        };
        return next;
      });
      setEditing(null);
      showNotification('Slot updated successfully', 'success');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  }

  const grid = data?.grid ?? [];
  const days = data?.days ?? [];

  // Admin can edit EVERYTHING (to assign Dept). Prof can edit ONLY own dept.
  const canEdit = (cell) => {
    if (isAdmin) return true;
    return isApproved && cell.department === user?.department;
  };

  if (loading && !data && !classId) return <div className="app-loading">Loading...</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoBox}>📅</div>
          <div style={{ marginLeft: '1rem' }}>
            <h1 style={styles.h1}>Timetable</h1>
            <p style={styles.h1Sub}>{classId ? `Class ${classId} ` : 'Select a class to view schedule'}</p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={{ textAlign: 'right', marginRight: '1.5rem' }}>
            <div style={styles.userInfo}>Professor {user?.name || user?.email.split('@')[0]}</div>
            <div style={styles.userMeta}>
              <span className={`status ${isApproved ? 'approved' : 'pending'} `}>{isApproved ? 'Active' : 'Pending'}</span>
              <span style={styles.deptBadge}>{user?.department || 'ADMIN'}</span>
            </div>
          </div>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      {!isApproved && !isAdmin && (
        <div style={styles.banner}>
          ⚠️ Your account is pending admin approval. Read-only access.
        </div>
      )}

      {isAdmin && (
        <div style={styles.bannerInfo}>
          🛠️ <strong>Admin Mode</strong>: Click any slot to assign a Department.
        </div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.selectWrapper}>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            style={styles.select}
          >
            <option value="">Select Class Group</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {data && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thPeriod}>Period</th>
                {days.map(d => <th key={d} style={styles.th}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, pi) => (
                <tr key={pi} style={styles.tr}>
                  <td style={styles.tdPeriod}>
                    <div style={styles.periodNum}>{pi + 1}</div>
                    <div style={styles.periodTime}>10:00 - 11:00</div>
                  </td>
                  {row.map((cell, di) => (
                    <td key={di} style={styles.td}>
                      {editing?.[0] === pi && editing?.[1] === di ? (
                        <div style={styles.editCard}>
                          {isAdmin ? (
                            <select
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              style={styles.editInput}
                              autoFocus
                            >
                              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          ) : (
                            <input
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              style={styles.editInput}
                              placeholder="Enter Subject..."
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && saveSlot()}
                            />
                          )}

                          <div style={styles.editActions}>
                            <button onClick={saveSlot} style={styles.btnSave}>Save</button>
                            <button onClick={() => setEditing(null)} style={styles.btnCancel}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            ...styles.cell,
                            ...(canEdit(cell) ? styles.cellEditable : {}),
                            ...(cell.subject ? styles.cellFilled : {}),
                          }}
                          onClick={() => {
                            if (canEdit(cell)) {
                              setEditing([pi, di]);
                              setEditVal(isAdmin ? cell.department : (cell.subject || ''));
                            }
                          }}
                        >
                          <div style={styles.cellHeader}>
                            <span style={styles.deptTag}>{cell.department}</span>
                            {isAdmin && <span style={{ fontSize: '0.6rem', color: '#64748b' }}>🖊️</span>}
                          </div>
                          <div style={styles.cellContent}>
                            {cell.subject ? (
                              <span style={styles.subject}>{cell.subject}</span>
                            ) : canEdit(cell) && !isAdmin ? (
                              <span style={styles.hint}>+ Add Subject</span>
                            ) : <span style={styles.empty}>—</span>}
                          </div>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 1400, margin: '0 auto', padding: '2rem' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' },
  headerLeft: { display: 'flex', gap: '1rem', alignItems: 'center' },
  logoBox: { fontSize: '2rem', background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '12px' },
  h1: { fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' },
  h1Sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' },
  headerRight: { display: 'flex', gap: '1.5rem', alignItems: 'center' },
  userInfo: { fontWeight: '600', fontSize: '0.9rem' },
  userMeta: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.2rem' },
  deptBadge: { background: 'var(--bg-card-hover)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', border: '1px solid var(--border)' },

  banner: { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' },
  bannerInfo: { background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' },

  toolbar: { marginBottom: '2rem' },
  selectWrapper: { position: 'relative', width: '250px' },
  select: { width: '100%', padding: '0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '1rem', cursor: 'pointer' },

  tableWrap: { borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'rgba(15, 23, 42, 0.4)' },

  th: { padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' },
  thPeriod: { width: '80px', padding: '1rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' },

  tr: { borderBottom: '1px solid var(--border)' },
  tdPeriod: { padding: '1rem', background: 'rgba(0,0,0,0.1)', textAlign: 'center' },
  periodNum: { fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-muted)' },
  periodTime: { fontSize: '0.7rem', color: '#64748b' },

  td: { padding: '0.5rem', verticalAlign: 'top', height: '100px' },

  cell: {
    height: '100%', minHeight: '80px', padding: '0.8rem', borderRadius: '8px',
    background: 'rgba(255,255,255,0.02)', border: '1px solid transparent',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    transition: 'all 0.2s', cursor: 'default'
  },
  cellEditable: { cursor: 'pointer', background: 'rgba(79, 70, 229, 0.05)', border: '1px dashed rgba(79, 70, 229, 0.3)' },
  cellFilled: { background: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.2)' },

  cellHeader: { display: 'flex', justifyContent: 'space-between' },
  deptTag: { fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' },

  cellContent: { flex: 1, display: 'flex', alignItems: 'center' },
  subject: { fontWeight: '600', fontSize: '0.95rem', color: '#fff' },
  hint: { fontSize: '0.8rem', color: '#818cf8' },
  empty: { color: '#334155' },

  editCard: { background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 10, position: 'relative' },
  editInput: { width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--primary)', borderRadius: '4px', color: 'white' },
  editActions: { display: 'flex', gap: '0.5rem' },
  btnSave: { flex: 1, background: 'var(--primary)', border: 'none', padding: '0.4rem', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' },
  btnCancel: { flex: 1, background: 'transparent', border: '1px solid var(--border)', padding: '0.4rem', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' },

  errorBanner: { padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', marginBottom: '1rem' }
};
