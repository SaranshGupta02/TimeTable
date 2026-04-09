import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { getClasses, getTimetable, updateSlot } from './api';
import SearchBar from './SearchBar';
import StatsPanel from './StatsPanel';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'MATH', 'PHYSICS', 'Common'];

const DEPT_COLORS = {
  CSE:     { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', light: '#dbeafe' },
  ECE:     { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', light: '#dcfce7' },
  MECH:    { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', light: '#ffedd5' },
  MATH:    { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff', light: '#f3e8ff' },
  PHYSICS: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', light: '#fee2e2' },
  Common:  { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', light: '#f1f5f9' },
};

function getDeptColor(dept) {
  return DEPT_COLORS[dept] || DEPT_COLORS.Common;
}

const THEME = {
  bg: '#f8fafc',
  headerBg: '#ffffff',
  textMain: '#0f172a',
  textMuted: '#64748b',
  primary: '#4f46e5',
  primaryLight: '#e0e7ff',
  border: '#e2e8f0',
  cardBg: '#ffffff',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
};

// Skeleton row for loading
function SkeletonRow({ cols }) {
  return (
    <tr>
      <td style={{ padding: '1rem', background: '#f8fafc' }}>
        <div className="skeleton" style={{ width: '60px', height: '20px', borderRadius: '6px' }} />
        <div className="skeleton" style={{ width: '80px', height: '14px', borderRadius: '6px', marginTop: '6px' }} />
      </td>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '1rem', verticalAlign: 'top', height: '100px' }}>
          <div className="skeleton" style={{ width: '60%', height: '16px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ width: '80%', height: '20px', borderRadius: '6px', marginTop: '8px' }} />
        </td>
      ))}
    </tr>
  );
}

export default function Timetable() {
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);

  // New feature states
  const [deptFilter, setDeptFilter] = useState('All');
  const [showStats, setShowStats] = useState(false);

  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isApproved = user?.is_approved === 1 || isAdmin;

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch(e => showNotification(e.message, 'error'))
      .finally(() => setLoading(false));
    document.body.style.background = '#f8fafc';
    return () => { document.body.style.background = ''; };
  }, []);

  useEffect(() => {
    if (!classId) { setData(null); return; }
    setTableLoading(true);
    setSearchParams({ classId });
    getTimetable(classId)
      .then(d => { setData(d); setDeptFilter('All'); })
      .catch(e => showNotification(e.message, 'error'))
      .finally(() => setTableLoading(false));
  }, [classId]);

  const downloadPDF = async () => {
    const element = document.getElementById('timetable-grid');
    if (!element) return;
    showNotification('Generating PDF...', 'loading', { duration: 5000 });
    try {
      const canvas = await html2canvas(element, {
        scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Timetable — Class ${classId}`, 10, 10);
      pdf.addImage(imgData, 'PNG', 0, 16, pdfWidth, pdfHeight);
      pdf.save(`timetable-${classId}.pdf`);
      showNotification('PDF downloaded! 📥', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to generate PDF', 'error');
    }
  };

  const downloadCSV = () => {
    if (!data) return;
    const { grid, days, time_slots } = data;
    const headers = ['Period', 'Time', ...days];
    const rows = grid.map((row, pi) => {
      const cells = row.map(cell => `"${cell.department}: ${cell.subject || 'TBD'}"`);
      return [`"Period ${pi + 1}"`, `"${time_slots[pi] || ''}"`, ...cells];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable-${classId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('CSV downloaded! 📊', 'success');
  };

  async function saveSlot() {
    if (editing == null) return;
    const [periodIndex, dayIndex] = editing;
    setSavingSlot(true);
    try {
      const subject = isAdmin ? '' : editVal;
      const department = isAdmin ? editVal : null;
      await updateSlot(classId, dayIndex, periodIndex, subject, department);
      setData(prev => ({
        ...prev,
        grid: prev.grid.map((row, pi) =>
          pi === periodIndex
            ? row.map((cell, di) =>
                di === dayIndex
                  ? isAdmin ? { ...cell, department: editVal } : { ...cell, subject: editVal }
                  : cell
              )
            : row
        )
      }));
      setEditing(null);
      showNotification('Slot updated ✓', 'success', { duration: 2000 });
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setSavingSlot(false);
    }
  }

  const grid = data?.grid ?? [];
  const days = data?.days ?? [];
  const timeSlots = data?.time_slots ?? [];

  const canEdit = (cell) => {
    if (isAdmin) return true;
    return isApproved && cell.department === user?.department;
  };

  const isCellDimmed = (cell) => {
    if (deptFilter === 'All') return false;
    return cell.department !== deptFilter;
  };

  const handleClassChange = (newClassId) => {
    setSearchParams({ classId: newClassId }, { replace: true });
    setClassId(newClassId);
  };

  if (loading) return (
    <div style={{ background: THEME.bg, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="page-spinner" />
      <div style={{ color: THEME.textMuted, fontSize: '1.1rem', fontWeight: '500' }}>Loading Timetable...</div>
    </div>
  );

  return (
    <div style={{ background: THEME.bg, minHeight: '100vh', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 2rem', fontFamily: "'Inter', sans-serif", color: THEME.textMain }}>

        {/* ---- HEADER ---- */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem',
          alignItems: 'center', background: THEME.headerBg, padding: '1.2rem 1.5rem',
          borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
          flexWrap: 'wrap', gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ fontSize: '2rem', background: THEME.primaryLight, padding: '0.6rem', borderRadius: '12px' }}>📅</div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>Timetable</h1>
              <p style={{ margin: 0, color: THEME.textMuted, fontSize: '0.9rem' }}>
                {classId ? `Class ${classId}` : 'Select a class to view schedule'}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <SearchBar onNavigate={handleClassChange} />

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                {isAdmin ? '🛠️ Admin' : `Prof. ${user?.name || user?.email.split('@')[0]}`}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                <span style={{ color: isApproved ? THEME.success : THEME.warning, fontWeight: 'bold', fontSize: '0.75rem' }}>
                  {isApproved ? '● Active' : '● Pending'}
                </span>
                <span style={{ background: THEME.primaryLight, color: THEME.primary, padding: '1px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {user?.department || 'ADMIN'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                style={{
                  background: THEME.primaryLight, border: `1px solid ${THEME.primary}20`,
                  color: THEME.primary, padding: '0.5rem 1rem', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}
              >
                ← Dashboard
              </button>
            )}
            <button onClick={logout} style={{
              background: '#fff', border: `1px solid ${THEME.border}`, color: THEME.textMain,
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'
            }}>
              Logout
            </button>
          </div>
        </header>

        {/* ---- BANNERS ---- */}
        {!isApproved && !isAdmin && (
          <div style={{ background: '#fffbeb', border: `1px solid ${THEME.warning}`, color: '#b45309', padding: '0.9rem 1rem', borderRadius: '10px', marginBottom: '1.5rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚠️ Your account is pending admin approval. You have read-only access.
          </div>
        )}
        {isAdmin && (
          <div style={{ background: '#eff6ff', border: `1px solid #93c5fd`, color: '#1d4ed8', padding: '0.9rem 1rem', borderRadius: '10px', marginBottom: '1.5rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🛠️ <strong>Admin Mode</strong>: Click any slot to assign a Department.
          </div>
        )}

        {/* ---- TOOLBAR ---- */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {/* Class selector */}
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <select
              value={classId}
              onChange={e => handleClassChange(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem 1rem', background: THEME.cardBg,
                border: `1px solid ${THEME.border}`, borderRadius: '10px', color: THEME.textMain,
                fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <option value="">Select Class Group</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Department filter */}
          {data && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: THEME.textMuted, fontWeight: '600', marginRight: '0.2rem' }}>Filter:</span>
              {['All', ...DEPARTMENTS].map(d => {
                const colors = d !== 'All' ? getDeptColor(d) : null;
                const isActive = deptFilter === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDeptFilter(d)}
                    style={{
                      padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700',
                      border: isActive
                        ? (colors ? `1.5px solid ${colors.color}` : `1.5px solid ${THEME.primary}`)
                        : `1px solid ${THEME.border}`,
                      background: isActive
                        ? (colors ? colors.bg : THEME.primaryLight)
                        : 'transparent',
                      color: isActive
                        ? (colors ? colors.color : THEME.primary)
                        : THEME.textMuted,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.6rem' }} data-html2canvas-ignore="true">
            {data && (
              <>
                <button
                  onClick={() => setShowStats(s => !s)}
                  style={{
                    padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600',
                    border: `1px solid ${THEME.border}`, background: showStats ? THEME.primaryLight : '#fff',
                    color: showStats ? THEME.primary : THEME.textMuted, cursor: 'pointer',
                  }}
                >
                  📊 {showStats ? 'Hide' : 'Stats'}
                </button>
                <button
                  onClick={downloadCSV}
                  style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', border: `1px solid ${THEME.border}`, background: '#fff', color: THEME.textMuted, cursor: 'pointer' }}
                >
                  📋 CSV
                </button>
                <button
                  onClick={downloadPDF}
                  style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', background: THEME.success, color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  📥 PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* ---- STATS PANEL ---- */}
        {showStats && (
          <div style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <StatsPanel currentClassId={classId} />
          </div>
        )}

        {/* ---- TIMETABLE TABLE ---- */}
        <div style={{ borderRadius: '16px', border: `1px solid ${THEME.border}`, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }} id="timetable-grid">
          <table style={{ width: '100%', borderCollapse: 'collapse', background: THEME.cardBg }}>
            <thead>
              <tr>
                <th style={{ padding: '1.1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: THEME.textMuted, borderBottom: `1px solid ${THEME.border}`, background: '#f8fafc', fontWeight: '700', width: '110px' }}>
                  Time
                </th>
                {!tableLoading && days.map(d => (
                  <th key={d} style={{ padding: '1.1rem', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: THEME.textMuted, borderBottom: `1px solid ${THEME.border}`, background: '#f8fafc', fontWeight: '700' }}>
                    {d}
                  </th>
                ))}
                {tableLoading && Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} style={{ padding: '1.1rem', background: '#f8fafc', borderBottom: `1px solid ${THEME.border}` }}>
                    <div className="skeleton" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                : !data
                ? (
                  <tr>
                    <td colSpan={days.length + 1 || 6} style={{ padding: '4rem', textAlign: 'center', color: THEME.textMuted }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>Select a class to view its timetable</div>
                      <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Or use the search bar above to find a specific subject</div>
                    </td>
                  </tr>
                )
                : grid.map((row, pi) => (
                  <tr key={pi} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: '1rem', background: '#f8fafc', textAlign: 'center', borderRight: `1px solid ${THEME.border}` }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: THEME.textMain }}>{pi + 1}</div>
                      <div style={{ fontSize: '0.7rem', color: THEME.textMuted, marginTop: '2px', whiteSpace: 'nowrap' }}>
                        {timeSlots[pi] || `${pi + 9}:00`}
                      </div>
                    </td>
                    {row.map((cell, di) => {
                      const colors = getDeptColor(cell.department);
                      const dimmed = isCellDimmed(cell);
                      const editable = canEdit(cell);
                      const isEditing = editing?.[0] === pi && editing?.[1] === di;

                      return (
                        <td key={di} style={{
                          padding: 0, verticalAlign: 'top',
                          width: `${100 / days.length}%`,
                          borderRight: `1px solid ${THEME.border}`,
                          opacity: dimmed ? 0.3 : 1,
                          transition: 'opacity 0.2s',
                        }}>
                          {isEditing ? (
                            <div style={{
                              padding: '0.75rem', background: '#fafafe',
                              border: `2px solid ${THEME.primary}`, borderRadius: '4px',
                              minHeight: '100px'
                            }}>
                              {isAdmin ? (
                                <select
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  style={{
                                    width: '100%', padding: '0.5rem', marginBottom: '0.6rem',
                                    background: '#f8fafc', border: `1px solid ${THEME.border}`,
                                    borderRadius: '6px', color: THEME.textMain, fontSize: '0.85rem'
                                  }}
                                  autoFocus
                                >
                                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              ) : (
                                <input
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  style={{
                                    width: '100%', padding: '0.5rem', marginBottom: '0.6rem',
                                    background: '#f8fafc', border: `1px solid ${THEME.border}`,
                                    borderRadius: '6px', color: THEME.textMain, fontSize: '0.85rem',
                                    boxSizing: 'border-box'
                                  }}
                                  placeholder="Subject name..."
                                  autoFocus
                                  list="subject-suggestions"
                                  onKeyDown={e => e.key === 'Enter' && saveSlot()}
                                />
                              )}
                              <datalist id="subject-suggestions">
                                {['Machine Learning','Operating Systems','DBMS','Computer Networks','Software Engineering',
                                  'Compiler Design','Theory of Computation','Web Technologies','Artificial Intelligence',
                                  'Data Science','Cloud Computing','Cyber Security','Digital Signal Processing',
                                  'Microprocessors','Embedded Systems','Deep Learning','NLP','Computer Graphics'].map(s => (
                                  <option key={s} value={s} />
                                ))}
                              </datalist>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={saveSlot}
                                  disabled={savingSlot}
                                  style={{ flex: 1, background: THEME.primary, border: 'none', padding: '0.4rem', borderRadius: '5px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
                                >
                                  {savingSlot ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditing(null)}
                                  style={{ flex: 1, background: 'transparent', border: `1px solid ${THEME.border}`, padding: '0.4rem', borderRadius: '5px', color: THEME.textMuted, cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                height: '100%', minHeight: '100px', padding: '0.8rem',
                                display: 'flex', flexDirection: 'column', gap: '0.4rem',
                                transition: 'background 0.15s',
                                cursor: editable ? 'pointer' : 'default',
                                background: cell.subject
                                  ? colors.light
                                  : editable ? '#fdfbff' : 'white',
                              }}
                              onMouseEnter={e => {
                                if (editable && !dimmed) e.currentTarget.style.background = colors.bg;
                              }}
                              onMouseLeave={e => {
                                if (editable) e.currentTarget.style.background = cell.subject ? colors.light : editable ? '#fdfbff' : 'white';
                              }}
                              onClick={() => {
                                if (editable) {
                                  setEditing([pi, di]);
                                  setEditVal(isAdmin ? cell.department : (cell.subject || ''));
                                }
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                  fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                  color: colors.color,
                                  background: colors.bg,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: `1px solid ${colors.border}`
                                }}>
                                  {cell.department}
                                </span>
                                {editable && isAdmin && (
                                  <span style={{ fontSize: '0.75rem', color: THEME.textMuted }} data-html2canvas-ignore="true">✎</span>
                                )}
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                {cell.subject ? (
                                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: colors.color }}>{cell.subject}</span>
                                ) : editable && !isAdmin ? (
                                  <span style={{ fontSize: '0.8rem', color: '#c4b5fd' }} data-html2canvas-ignore="true">+ Add Subject</span>
                                ) : (
                                  <span style={{ color: '#cbd5e1', fontSize: '1.2rem' }}>—</span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* ---- LEGEND ---- */}
        {data && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }} data-html2canvas-ignore="true">
            <span style={{ fontSize: '0.75rem', color: THEME.textMuted, fontWeight: '600' }}>DEPARTMENTS:</span>
            {DEPARTMENTS.map(dept => {
              const colors = getDeptColor(dept);
              return (
                <span key={dept} style={{
                  fontSize: '0.72rem', fontWeight: '700', padding: '3px 9px', borderRadius: '20px',
                  background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`
                }}>
                  {dept}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
