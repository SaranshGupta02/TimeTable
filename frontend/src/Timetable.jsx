import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { getClasses, getTimetable, updateSlot } from './api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [editVal, setEditVal] = useState('');

  const isAdmin = user?.role === 'admin';
  const isApproved = user?.is_approved === 1 || isAdmin;

  const DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'MATH', 'PHYSICS', 'Common'];

  // Light Theme Constants
  const THEME = {
    bg: '#f8fafc', // Slate 50
    headerBg: '#ffffff',
    textMain: '#0f172a', // Slate 900
    textMuted: '#64748b', // Slate 500
    primary: '#4f46e5', // Indigo 600
    primaryLight: '#e0e7ff', // Indigo 100
    border: '#e2e8f0', // Slate 200
    cardBg: '#ffffff',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    hover: '#f1f5f9'
  };

  useEffect(() => {
    getClasses().then(setClasses).catch(e => showNotification(e.message, 'error')).finally(() => setLoading(false));
    // Override body background for light theme
    document.body.style.background = '#f8fafc';
    return () => {
      document.body.style.background = ''; // Cleanup
    };
  }, []);

  useEffect(() => {
    if (!classId) { setData(null); return; }
    setLoading(true);
    setSearchParams({ classId });
    getTimetable(classId).then(setData).catch(e => showNotification(e.message, 'error')).finally(() => setLoading(false));
  }, [classId]);

  const downloadPDF = async () => {
    const element = document.getElementById('timetable-grid');
    if (!element) return;
    try {
      html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff', // Force white background for PDF
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42); // Dark slate
      pdf.text(`Timetable - ${classId}`, 10, 10);

      pdf.addImage(imgData, 'PNG', 0, 15, pdfWidth, pdfHeight);
      pdf.save(`timetable-${classId}.pdf`);
      showNotification('Downloaded successfully', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to download PDF', 'error');
    }
  };

  async function saveSlot() {
    if (editing == null) return;
    const [periodIndex, dayIndex] = editing;
    try {
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
  const timeSlots = data?.time_slots ?? [];

  const canEdit = (cell) => {
    if (isAdmin) return true;
    return isApproved && cell.department === user?.department;
  };

  if (loading) return (
    <div style={{ background: THEME.bg, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      <div className="spinner"></div>
      <div style={{ color: THEME.textMuted, fontSize: '1.2rem', fontWeight: '500' }}>Fetching Timetable...</div>
      <style>{`
        .spinner {
          border: 4px solid ${THEME.primaryLight}; 
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border-left-color: ${THEME.primary};
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  const styles = {
    page: { maxWidth: '1400px', margin: '0 auto', padding: '2rem', fontFamily: "'Inter', sans-serif", color: THEME.textMain },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center', background: THEME.headerBg, padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' },
    headerLeft: { display: 'flex', gap: '1rem', alignItems: 'center' },
    logoBox: { fontSize: '2rem', background: THEME.primaryLight, padding: '0.6rem', borderRadius: '12px' },
    h1: { fontSize: '1.8rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: THEME.textMain },
    h1Sub: { margin: 0, color: THEME.textMuted, fontSize: '1rem' },
    headerRight: { display: 'flex', gap: '1.5rem', alignItems: 'center' },
    userInfo: { fontWeight: '600', fontSize: '0.9rem', color: THEME.textMain },
    userMeta: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.3rem' },
    deptBadge: { background: THEME.primaryLight, color: THEME.primary, padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' },

    banner: { background: '#fffbeb', border: `1px solid ${THEME.warning}`, color: '#b45309', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' },
    bannerInfo: { background: '#eff6ff', border: `1px solid ${THEME.primary}`, color: THEME.primary, padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' },

    toolbar: { marginBottom: '2rem' },
    select: { width: '100%', padding: '0.8rem', background: THEME.cardBg, border: `1px solid ${THEME.border}`, borderRadius: '12px', color: THEME.textMain, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },

    tableWrap: { borderRadius: '16px', border: `1px solid ${THEME.border}`, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' },
    table: { width: '100%', borderCollapse: 'collapse', background: THEME.cardBg },

    th: { padding: '1.2rem', textAlign: 'left', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: THEME.textMuted, borderBottom: `1px solid ${THEME.border}`, background: '#f8fafc', fontWeight: '700' },
    thPeriod: { width: '100px', padding: '1.2rem', borderBottom: `1px solid ${THEME.border}`, background: '#f8fafc', fontWeight: '700' },

    tr: { borderBottom: `1px solid ${THEME.border}` },
    tdPeriod: { padding: '1rem', background: '#f8fafc', textAlign: 'center', borderRight: `1px solid ${THEME.border}` },
    periodNum: { fontSize: '1.2rem', fontWeight: '800', color: THEME.textMain },
    periodTime: { fontSize: '0.75rem', color: THEME.textMuted, marginTop: '4px' },

    td: { padding: '0', verticalAlign: 'top', height: '110px', width: `${100 / days.length}%`, borderRight: `1px solid ${THEME.border}` },

    cell: {
      height: '100%', minHeight: '110px', padding: '1rem',
      background: 'white',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      transition: 'all 0.2s', cursor: 'default'
    },
    cellEditable: { cursor: 'pointer', background: '#fdfbff', '&:hover': { background: '#f5f3ff' } },
    cellFilled: { background: '#f0f9ff' }, // Light blue for filled

    cellHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' },
    deptTag: { fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: THEME.textMuted },

    cellContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
    subject: { fontWeight: '700', fontSize: '1rem', color: THEME.primary },
    hint: { fontSize: '0.85rem', color: THEME.primaryLight, fontWeight: '500', color: THEME.primary },
    empty: { color: '#cbd5e1' },

    editCard: { background: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', zIndex: 10, position: 'relative', border: `1px solid ${THEME.border}` },
    editInput: { width: '100%', padding: '0.6rem', marginBottom: '0.8rem', background: '#f8fafc', border: `1px solid ${THEME.border}`, borderRadius: '6px', color: THEME.textMain, fontSize: '0.9rem' },
    btnSave: { flex: 1, background: THEME.primary, border: 'none', padding: '0.5rem', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' },
    btnCancel: { flex: 1, background: 'transparent', border: `1px solid ${THEME.border}`, padding: '0.5rem', borderRadius: '6px', color: THEME.textMuted, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' },
  };

  const handleClassChange = (newClassId) => {
    setSearchParams({ classId: newClassId }, { replace: true });
    setClassId(newClassId);
  };

  return (
    <div style={{ background: THEME.bg, minHeight: '100vh', paddingBottom: '2rem' }}>
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
                <span className={`status ${isApproved ? 'approved' : 'pending'} `} style={{ color: isApproved ? THEME.success : THEME.warning, fontWeight: 'bold', fontSize: '0.8rem' }}>{isApproved ? 'Active' : 'Pending'}</span>
                <span style={styles.deptBadge}>{user?.department || 'ADMIN'}</span>
              </div>
            </div>
            <button onClick={logout} className="logout-btn" style={{ background: '#fff', border: `1px solid ${THEME.border}`, color: THEME.textMain }}>Logout</button>
          </div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }} data-html2canvas-ignore="true">
          <button onClick={downloadPDF} disabled={!data} style={{ ...styles.btnSave, maxWidth: '160px', background: THEME.success, boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
            Download PDF 📥
          </button>
        </div>

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
          <div style={{ position: 'relative', width: '250px' }}>
            <select
              value={classId}
              onChange={e => handleClassChange(e.target.value)}
              style={styles.select}
            >
              <option value="">Select Class Group</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ padding: '1rem', background: '#fef2f2', border: `1px solid ${THEME.danger}`, color: THEME.danger, borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

        {data && (
          <div style={styles.tableWrap} id="timetable-grid">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thPeriod}>Time</th>
                  {days.map(d => <th key={d} style={styles.th}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, pi) => (
                  <tr key={pi} style={styles.tr}>
                    <td style={styles.tdPeriod}>
                      <div style={styles.periodNum}>{pi + 1}</div>
                      {/* Use Custom Time Slot if available */}
                      <div style={styles.periodTime}>{timeSlots[pi] || `${pi + 9}:00 - ${pi + 10}:00`}</div>
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
                              <>
                                <input
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  style={styles.editInput}
                                  placeholder="Enter Subject..."
                                  autoFocus
                                  list="subject-suggestions"
                                  onKeyDown={e => e.key === 'Enter' && saveSlot()}
                                />
                                <datalist id="subject-suggestions">
                                  <option value="Machine Learning" />
                                  <option value="Operating Systems" />
                                  <option value="DBMS" />
                                  <option value="Computer Networks" />
                                  <option value="Software Engineering" />
                                  <option value="Compiler Design" />
                                  <option value="Theory of Computation" />
                                  <option value="Web Technologies" />
                                </datalist>
                              </>
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
                              ...(canEdit(cell) ? { cursor: 'pointer', background: '#fdfbff' } : {}), // Apply simplified hover effect
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
                              {isAdmin && (
                                <span
                                  style={{ fontSize: '0.8rem', color: THEME.primary }}
                                  data-html2canvas-ignore="true"
                                >
                                  ✎
                                </span>
                              )}
                            </div>
                            <div style={styles.cellContent}>
                              {cell.subject ? (
                                <span style={styles.subject}>{cell.subject}</span>
                              ) : canEdit(cell) && !isAdmin ? (
                                <span style={styles.hint} data-html2canvas-ignore="true">+ Add</span>
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
    </div>
  );
}
