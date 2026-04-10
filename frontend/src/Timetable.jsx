import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { getClasses, getTimetable, updateSlot } from './api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import SearchBar from './SearchBar';
import StatsPanel from './StatsPanel';

// ── NIT KKR Department full names ─────────────────────────────────────────────
const DEPT_FULL_NAME = {
  CSE:     'DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING',
  ECE:     'DEPARTMENT OF ELECTRONICS & COMMUNICATION ENGINEERING',
  MECH:    'DEPARTMENT OF MECHANICAL ENGINEERING',
  MATH:    'DEPARTMENT OF MATHEMATICS',
  PHYSICS: 'DEPARTMENT OF PHYSICS',
  Common:  'DEPARTMENT OF COMPUTER ENGINEERING',
  MCA:     'DEPARTMENT OF COMPUTER ENGINEERING',
};

// ── Room/Block mapping by department ─────────────────────────────────────────
const DEPT_ROOM = {
  CSE:     'CSE Block Room No. 101',
  ECE:     'ECE Block Room No. 201',
  MECH:    'Mechanical Block Room No. 301',
  MATH:    'Mathematics Block Room No. 401',
  PHYSICS: 'Physics Block Room No. 501',
  Common:  'MCA Block Room No. 306',
  MCA:     'MCA Block Room No. 306',
};

const CURRENT_SEMESTER = 'EVEN SEMESTER 2024-25';

// Derive dominant department from grid
function getDominantDept(grid) {
  const counts = {};
  grid.flat().forEach(c => { if (c.department && c.department !== 'Common') counts[c.department] = (counts[c.department]||0)+1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return top ? top[0] : 'Common';
}

// ── Palettes ──────────────────────────────────────────────────────────────────
const DEPT_PALETTE = {
  CSE:     { bg: '#e8f4fd', border: '#3b9ede', text: '#1a5f8a', dot: '#3b9ede' },
  ECE:     { bg: '#fdf0e8', border: '#e8863b', text: '#8a4a1a', dot: '#e8863b' },
  MECH:    { bg: '#edf7ed', border: '#3bba5e', text: '#1a6b31', dot: '#3bba5e' },
  MATH:    { bg: '#f3eeff', border: '#9b6de8', text: '#4e2a9a', dot: '#9b6de8' },
  PHYSICS: { bg: '#fff0f3', border: '#e8476a', text: '#8a1a33', dot: '#e8476a' },
  Common:  { bg: '#f0fafa', border: '#3bbaba', text: '#1a6b6b', dot: '#3bbaba' },
};
const DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'MATH', 'PHYSICS', 'Common'];
const DAY_ABBR = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
  Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN',
};

// ── Skeletons ─────────────────────────────────────────────────────────────────
function SkeletonCell() {
  return (
    <td className="tt-td" style={{ padding: 10 }}>
      <div className="skeleton" style={{ width: '55%', height: 11, borderRadius: 5, marginBottom: 6 }} />
      <div className="skeleton" style={{ width: '75%', height: 14, borderRadius: 5 }} />
    </td>
  );
}
function SkeletonRow({ cols }) {
  return (
    <tr>
      <td className="tt-td" style={{ background: '#fafafa', padding: '10px 8px', textAlign: 'center' }}>
        <div className="skeleton" style={{ width: 28, height: 14, borderRadius: 5, margin: '0 auto 4px' }} />
        <div className="skeleton" style={{ width: 40, height: 10, borderRadius: 5, margin: '0 auto' }} />
      </td>
      {Array.from({ length: cols }).map((_, i) => <SkeletonCell key={i} />)}
    </tr>
  );
}

// ── Sidebar section label ─────────────────────────────────────────────────────
function SideSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: '0.58rem', fontWeight: 700, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Timetable() {
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classes, setClasses]           = useState([]);
  const [classId, setClassId]           = useState(searchParams.get('classId') || '');
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [editing, setEditing]           = useState(null);
  const [editVal, setEditVal]           = useState('');
  const [savingSlot, setSavingSlot]     = useState(false);
  const [hoveredCell, setHoveredCell]   = useState(null);
  const [activeDay, setActiveDay]       = useState(null);
  const [deptFilter, setDeptFilter]     = useState('All');
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  const isAdmin    = user?.role === 'admin';
  const isApproved = user?.is_approved === 1 || isAdmin;

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch(e => showNotification(e.message, 'error'))
      .finally(() => setLoading(false));
    document.body.style.background = '#f0f2f5';
    return () => { document.body.style.background = ''; };
  }, []);

  useEffect(() => {
    if (!classId) { setData(null); return; }
    setTableLoading(true);
    setSearchParams({ classId });
    getTimetable(classId)
      .then(d => { setData(d); setDeptFilter('All'); setActiveDay(null); })
      .catch(e => showNotification(e.message, 'error'))
      .finally(() => setTableLoading(false));
  }, [classId]);

  const handleClassChange = (newId) => {
    setSearchParams({ classId: newId }, { replace: true });
    setClassId(newId);
  };

  const canEdit      = (cell) => isAdmin || (isApproved && cell.department === user?.department);
  const isCellDimmed = (cell) => deptFilter !== 'All' && cell.department !== deptFilter;

  async function saveSlot() {
    if (editing == null || savingSlot) return;
    const [pi, di] = editing;
    setSavingSlot(true);
    try {
      await updateSlot(classId, di, pi, isAdmin ? '' : editVal, isAdmin ? editVal : null);
      setData(prev => ({
        ...prev,
        grid: prev.grid.map((row, r) =>
          r === pi ? row.map((cell, c) =>
            c === di ? (isAdmin ? { ...cell, department: editVal } : { ...cell, subject: editVal }) : cell
          ) : row
        ),
      }));
      setEditing(null);
      showNotification('Slot updated ✓', 'success', { duration: 2000 });
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setSavingSlot(false);
    }
  }

  const downloadPDF = async () => {
    if (!data) return;
    showNotification('Generating PDF…', 'loading', { duration: 8000 });
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pgW = pdf.internal.pageSize.getWidth();   // 297mm
      const pgH = pdf.internal.pageSize.getHeight();  // 210mm
      const margin = 12;

      // ── Determine department / room info ──
      const dominantDept  = getDominantDept(grid);
      const deptFullName  = DEPT_FULL_NAME[dominantDept]  || DEPT_FULL_NAME.Common;
      const roomInfo      = DEPT_ROOM[dominantDept]       || DEPT_ROOM.Common;
      const blockLabel    = `${roomInfo.split(' ')[0]} BLOCK LAB TIME TABLE FOR ${CURRENT_SEMESTER}`;

      // ── Logo ──
      let logoY = 8;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej;
          img.src = '/logo.png';
        });
        const c2 = document.createElement('canvas');
        c2.width = img.naturalWidth; c2.height = img.naturalHeight;
        c2.getContext('2d').drawImage(img, 0, 0);
        const logoData = c2.toDataURL('image/png');
        const logoSize = 22;
        pdf.addImage(logoData, 'PNG', margin, logoY, logoSize, logoSize);
      } catch (_) { /* skip logo if load fails */ }

      // ── Header text ──
      const textX = pgW / 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(20, 20, 60);
      pdf.text(deptFullName, textX, 13, { align: 'center' });

      pdf.setFontSize(10);
      pdf.text('NATIONAL INSTITUTE OF TECHNOLOGY, KURUKSHETRA', textX, 19, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(40, 40, 40);
      pdf.text(roomInfo, textX, 25, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(blockLabel, textX, 31, { align: 'center' });

      // ── Divider ──
      pdf.setDrawColor(40, 40, 100);
      pdf.setLineWidth(0.5);
      pdf.line(margin, 34, pgW - margin, 34);

      // ── Timetable table ──
      const tableTop = 38;
      const colW0 = 18;  // Day column
      const usableW = pgW - margin * 2 - colW0;
      const numPeriods = timeSlots.length || 8;
      const colW = usableW / numPeriods;
      const rowH = (pgH - tableTop - 18) / days.length;

      const drawCell = (x, y, w2, h2, text, opts = {}) => {
        pdf.setDrawColor(180, 180, 210);
        pdf.setLineWidth(0.3);
        pdf.rect(x, y, w2, h2);
        if (text) {
          pdf.setFont(opts.bold ? 'helvetica' : 'helvetica', opts.bold ? 'bold' : 'normal');
          pdf.setFontSize(opts.fontSize || 7);
          pdf.setTextColor(...(opts.color || [30, 30, 30]));
          const lines = pdf.splitTextToSize(text, w2 - 3);
          const textH  = lines.length * (opts.fontSize || 7) * 0.4;
          const textY  = y + h2 / 2 - textH / 2 + (opts.fontSize || 7) * 0.35;
          pdf.text(lines, x + w2 / 2, textY, { align: 'center' });
        }
      };

      // Header row — period numbers + time slots
      const headerH = 12;
      drawCell(margin, tableTop, colW0, headerH, 'Day', { bold: true, fontSize: 8, color: [20, 20, 60] });
      for (let p = 0; p < numPeriods; p++) {
        const x = margin + colW0 + p * colW;
        const slotLabel = `${p + 1}\n${timeSlots[p] || ''}`;
        drawCell(x, tableTop, colW, headerH, slotLabel, { bold: true, fontSize: 6.5, color: [20, 20, 60] });
      }

      // Data rows
      for (let di = 0; di < days.length; di++) {
        const y = tableTop + headerH + di * rowH;
        drawCell(margin, y, colW0, rowH, days[di].slice(0, 3).toUpperCase(), { bold: true, fontSize: 7.5, color: [20, 20, 60] });
        for (let pi = 0; pi < numPeriods; pi++) {
          const x    = margin + colW0 + pi * colW;
          const cell = grid[pi]?.[di];
          const dept = cell?.department || '';
          const subj = cell?.subject || '';
          const cellText = subj ? `${subj}\n${dept}` : (dept && dept !== 'Common' ? dept : '');
          drawCell(x, y, colW, rowH, cellText, { fontSize: 6.5 });
        }
      }

      // ── Footer ──
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(130, 130, 130);
      pdf.text(`Class: ${classId}  |  Generated: ${new Date().toLocaleDateString('en-IN')}  |  NIT Kurukshetra`, pgW / 2, pgH - 6, { align: 'center' });

      pdf.save(`Timetable_${classId}_NIT_KKR.pdf`);
      showNotification('PDF downloaded! 📥', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to generate PDF', 'error');
    }
  };

  const downloadCSV = () => {
    if (!data) return;
    const { grid, days, time_slots } = data;
    const rows = grid.map((row, pi) => [
      `"Period ${pi + 1}"`, `"${time_slots[pi] || ''}"`,
      ...row.map(c => `"${c.department}: ${c.subject || 'TBD'}"`),
    ]);
    const csv = [['Period', 'Time', ...days], ...rows].map(r => r.join(',')).join('\n');
    const a   = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `timetable-${classId}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
    showNotification('CSV downloaded! 📊', 'success');
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const grid      = data?.grid ?? [];
  const days      = data?.days ?? [];
  const timeSlots = data?.time_slots ?? [];

  const userInitials = (user?.name || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const todayName  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  const todayIndex = days.indexOf(todayName);

  const totalSlots  = grid.flat().length;
  const filledSlots = grid.flat().filter(c => c.subject).length;
  const fillPct     = totalSlots > 0 ? Math.round(filledSlots / totalSlots * 100) : 0;
  const deptCounts  = {};
  grid.flat().forEach(c => { if (c.department) deptCounts[c.department] = (deptCounts[c.department] || 0) + 1; });
  const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading && !data) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5', flexDirection: 'column', gap: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, border: '3px solid #e0e0e0', borderTop: '3px solid #1a1a2e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: '#888', fontSize: '0.85rem', letterSpacing: '0.05em' }}>LOADING TIMETABLE</span>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e6e6e6 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

        /* Table */
        .tt-table { width: 100%; border-collapse: collapse; }
        .tt-th {
          padding: 9px 10px; text-align: left;
          background: #fafafa; border-bottom: 1px solid #ebebeb; border-right: 1px solid #ebebeb;
          position: sticky; top: 0; z-index: 2;
        }
        .tt-th.today-th { background: #1a1a2e !important; }
        .tt-th.today-th .day-abbr { color: #ffdd57 !important; }
        .tt-td {
          padding: 0; vertical-align: top;
          border-right: 1px solid #ebebeb; border-bottom: 1px solid #ebebeb;
        }
        .tt-tr:last-child .tt-td { border-bottom: none; }
        .tt-td:last-child, .tt-th:last-child { border-right: none; }

        /* Compact cell — key to fitting without vertical scroll */
        .tt-cell-wrap {
          min-height: 68px; padding: 8px 9px;
          display: flex; flex-direction: column; gap: 3px;
          transition: background 0.15s ease; cursor: default; position: relative;
        }
        .tt-cell-wrap.editable { cursor: pointer; }
        .tt-cell-wrap.editable:hover { background: #f5f7ff !important; }
        .tt-cell-wrap.editable:hover .tt-add-hint { opacity: 1 !important; }
        .tt-add-hint { opacity: 0; transition: opacity 0.15s; }

        /* Dept pill */
        .dept-pill {
          display: inline-block; padding: 1px 6px; border-radius: 20px;
          font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
        }

        /* Subject text */
        .subject-text {
          font-size: 0.77rem; font-weight: 600; line-height: 1.3; text-align: center;
        }

        /* Edit controls */
        .tt-edit-input {
          width: 100%; padding: 6px 9px;
          background: #f8f9ff; border: 1.5px solid #d0d5e8; border-radius: 7px;
          color: #1a1a2e; font-family: 'DM Sans', sans-serif; font-size: 0.78rem;
          outline: none; transition: border-color 0.15s;
        }
        .tt-edit-input:focus { border-color: #4f46e5; background: #fff; }
        .tt-select {
          appearance: none; width: 100%; padding: 7px 11px;
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 8px;
          color: #1a1a2e; font-family: 'DM Sans', sans-serif; font-size: 0.82rem;
          cursor: pointer; outline: none; transition: border-color 0.15s;
        }
        .tt-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.07); }

        /* Inline edit buttons */
        .tt-btn-primary {
          padding: 5px 10px; background: #1a1a2e; color: #fff; border: none;
          border-radius: 7px; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
          display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        }
        .tt-btn-primary:hover { background: #2d2d4e; }
        .tt-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .tt-btn-ghost {
          padding: 5px 10px; background: transparent; color: #6b7280;
          border: 1.5px solid #e5e7eb; border-radius: 7px;
          font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 500; cursor: pointer;
          transition: background 0.15s; display: inline-flex; align-items: center; justify-content: center;
        }
        .tt-btn-ghost:hover { background: #f3f4f6; }

        /* Sidebar export buttons */
        .side-export-btn {
          width: 100%; padding: 10px 14px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 600;
          cursor: pointer; border: none;
          display: flex; align-items: center; gap: 8px;
          transition: opacity 0.15s, transform 0.1s;
        }
        .side-export-btn:active { transform: scale(0.98); }
        .side-export-btn:disabled { opacity: 0.38; cursor: not-allowed; }

        /* Mini stat card */
        .mini-stat {
          background: #f9fafb; border-radius: 9px; padding: 8px 6px;
          border: 1px solid #ebebeb; flex: 1;
        }

        /* Scrollable areas */
        .tt-scroll { overflow: auto; flex: 1; }
        .tt-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .tt-scroll::-webkit-scrollbar-track { background: transparent; }
        .tt-scroll::-webkit-scrollbar-thumb { background: #ddd; border-radius: 10px; }
        .side-scroll { overflow-y: auto; flex: 1; }
        .side-scroll::-webkit-scrollbar { width: 4px; }
        .side-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }

        /* Logout */
        .logout-btn-tt {
          padding: 5px 10px; background: transparent; color: #6b7280;
          border: 1.5px solid #e5e7eb; border-radius: 7px;
          font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500; cursor: pointer;
          transition: all 0.15s;
        }
        .logout-btn-tt:hover { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }

        /* Force SearchBar full width inside sidebar */
        .sidebar-search > div { max-width: 100% !important; width: 100% !important; }
        .sidebar-search .search-bar { border-radius: 9px !important; }
      `}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #ebebeb',
        padding: '0 18px', height: 58, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10,
      }}>
        {/* NIT KKR Logo + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/logo.png"
            alt="NIT Kurukshetra"
            style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1a1a2e', letterSpacing: '0.01em', lineHeight: 1.2 }}>NATIONAL INSTITUTE OF TECHNOLOGY</div>
            <div style={{ fontWeight: 600, fontSize: '0.7rem', color: '#7c3aed', letterSpacing: '0.04em', lineHeight: 1.2 }}>KURUKSHETRA</div>
            {classId && <div style={{ fontSize: '0.56rem', color: '#9ca3af', fontWeight: 500, marginTop: 1 }}>Timetable · Class {classId}</div>}
          </div>
        </div>

        {/* Right: user + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px', background: '#f9fafb', borderRadius: 100, border: '1px solid #ebebeb' }}>
            <div style={{ width: 22, height: 22, background: '#1a1a2e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 700, color: '#fff' }}>
              {userInitials}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1a1a2e', lineHeight: 1.2 }}>{user?.name || user?.email?.split('@')[0]}</div>
              <div style={{ fontSize: '0.58rem', color: '#9ca3af' }}>{user?.department || 'Admin'}</div>
            </div>
            <span style={{
              marginLeft: 2, padding: '1px 5px', borderRadius: 20,
              fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              background: isApproved ? '#dcfce7' : '#fef9c3',
              color:       isApproved ? '#15803d' : '#a16207',
            }}>{isApproved ? 'active' : 'pending'}</span>
          </div>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={{ padding: '5px 10px', background: '#e0e7ff', border: 'none', color: '#4f46e5', borderRadius: 7, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
              ← Dashboard
            </button>
          )}
          <button className="logout-btn-tt" onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT: timetable area ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 0 12px 14px' }}>

          {/* Sub-toolbar: banners + class selector + day pills */}
          <div style={{ paddingRight: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>

            {/* ── Institutional info banner ── */}
            {data && !tableLoading && (() => {
              const domDept    = getDominantDept(grid);
              const deptFull   = DEPT_FULL_NAME[domDept]  || DEPT_FULL_NAME.Common;
              const roomInfo   = DEPT_ROOM[domDept]       || DEPT_ROOM.Common;
              const blockLabel = `${roomInfo} · LAB TIME TABLE FOR ${CURRENT_SEMESTER}`;
              return (
                <div style={{
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d5e 100%)',
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <img src="/logo.png" alt="NIT KKR" style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0, filter: 'brightness(1.1)' }} onError={e => { e.target.style.display = 'none'; }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.77rem', color: '#fff', letterSpacing: '0.03em', lineHeight: 1.3 }}>{deptFull}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.68rem', color: '#a5b4fc', letterSpacing: '0.04em', lineHeight: 1.3 }}>NATIONAL INSTITUTE OF TECHNOLOGY, KURUKSHETRA</div>
                    <div style={{ fontSize: '0.6rem', color: '#93c5fd', marginTop: 2, fontWeight: 500 }}>{blockLabel}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', fontWeight: 700, color: '#ffdd57', letterSpacing: '-0.01em' }}>{classId}</div>
                    <div style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: 1 }}>Class ID</div>
                  </div>
                </div>
              );
            })()}

            {!isApproved && !isAdmin && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#92400e', fontWeight: 500 }}>
                <span>⚠</span> Your account is pending approval — read-only access.
              </div>
            )}
            {isAdmin && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#1e40af', fontWeight: 500 }}>
                <span>🛠</span> <strong>Admin mode</strong> — click any slot to assign a department.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Class selector */}
              <div style={{ position: 'relative', minWidth: 190 }}>
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="10" rx="1.5" stroke="#9ca3af" strokeWidth="1.4"/>
                  <line x1="4" y1="1" x2="4" y2="5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="10" y1="1" x2="10" y2="5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <select
                  className="tt-select"
                  value={classId}
                  onChange={e => handleClassChange(e.target.value)}
                  style={{ paddingLeft: 27, fontSize: '0.78rem', padding: '7px 11px 7px 27px' }}
                >
                  <option value="">Select class group…</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Day filter pills */}
              {data && !tableLoading && days.map((d, i) => (
                <button key={d}
                  onClick={() => setActiveDay(activeDay === i ? null : i)}
                  style={{
                    padding: '4px 9px', borderRadius: 20,
                    border: activeDay === i ? '1.5px solid #1a1a2e' : '1.5px solid #e5e7eb',
                    background: activeDay === i ? '#1a1a2e' : (i === todayIndex ? '#fffbeb' : 'transparent'),
                    color: activeDay === i ? '#fff' : (i === todayIndex ? '#92400e' : '#6b7280'),
                    fontSize: '0.67rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {DAY_ABBR[d] || d.slice(0, 3).toUpperCase()}
                  {i === todayIndex && <span style={{ marginLeft: 3, fontSize: '0.54rem' }}>TODAY</span>}
                </button>
              ))}
              {activeDay !== null && (
                <button onClick={() => setActiveDay(null)} style={{ fontSize: '0.67rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  show all
                </button>
              )}
            </div>
          </div>

          {/* Timetable grid (scrollable) */}
          <div
            id="timetable-grid"
            className="tt-scroll"
            style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebebeb', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', marginRight: 14 }}
          >
            {(data || tableLoading) && (
              <table className="tt-table">
                <thead>
                  <tr>
                    <th className="tt-th" style={{ width: 76, minWidth: 76 }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#d1d5db', textTransform: 'uppercase', letterSpacing: '0.07em' }}>PERIOD</div>
                    </th>
                    {tableLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <th key={i} className="tt-th">
                            <div className="skeleton" style={{ width: 60, height: 11, borderRadius: 4 }} />
                          </th>
                        ))
                      : days.map((d, i) => {
                          const isToday    = i === todayIndex;
                          const isFiltered = activeDay !== null && activeDay !== i;
                          if (isFiltered) return null;
                          return (
                            <th key={d} className={`tt-th${isToday ? ' today-th' : ''}`} style={{ minWidth: 100 }}>
                              <div className="day-abbr" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', color: isToday ? '#ffdd57' : '#9ca3af' }}>
                                {DAY_ABBR[d] || d.slice(0, 3).toUpperCase()}
                              </div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isToday ? '#fff' : '#1a1a2e', marginTop: 1 }}>{d}</div>
                            </th>
                          );
                        })
                    }
                  </tr>
                </thead>
                <tbody>
                  {tableLoading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                    : grid.map((row, pi) => (
                        <tr key={pi} className="tt-tr">
                          <td className="tt-td" style={{ background: '#fafafa', textAlign: 'center', padding: '8px 6px', minWidth: 76 }}>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', fontWeight: 500, color: '#1a1a2e' }}>
                              {String(pi + 1).padStart(2, '0')}
                            </div>
                            <div style={{ fontSize: '0.56rem', color: '#9ca3af', marginTop: 3, fontWeight: 500, lineHeight: 1.3 }}>
                              {timeSlots[pi] || `${pi + 9}:00`}
                            </div>
                          </td>

                          {row.map((cell, di) => {
                            const isToday    = di === todayIndex;
                            const isFiltered = activeDay !== null && activeDay !== di;
                            if (isFiltered) return null;

                            const pal      = DEPT_PALETTE[cell.department] || null;
                            const editMe   = editing?.[0] === pi && editing?.[1] === di;
                            const editable = canEdit(cell);
                            const dimmed   = isCellDimmed(cell);

                            return (
                              <td key={di} className="tt-td" style={{
                                background: isToday ? '#fffdf0' : 'transparent',
                                opacity: dimmed ? 0.2 : 1,
                                transition: 'opacity 0.2s',
                              }}>
                                {editMe ? (
                                  <div style={{ padding: 9, background: '#fff', minHeight: 68, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {isAdmin ? (
                                      <select className="tt-select" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus style={{ fontSize: '0.78rem', padding: '5px 9px' }}>
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                      </select>
                                    ) : (
                                      <>
                                        <input
                                          className="tt-edit-input"
                                          value={editVal}
                                          onChange={e => setEditVal(e.target.value)}
                                          placeholder="Subject name…"
                                          autoFocus
                                          list="subject-suggestions"
                                          onKeyDown={e => e.key === 'Enter' && saveSlot()}
                                        />
                                        <datalist id="subject-suggestions">
                                          {['Machine Learning','Operating Systems','DBMS','Computer Networks','Software Engineering',
                                            'Compiler Design','Theory of Computation','Web Technologies','Mobile App Development',
                                            'Artificial Intelligence','Data Science','Cloud Computing','Cyber Security',
                                            'Digital Signal Processing','Microprocessors','Embedded Systems','Computer Graphics',
                                            'Deep Learning','Natural Language Processing','Distributed Computing'].map(s => (
                                            <option key={s} value={s}/>
                                          ))}
                                        </datalist>
                                      </>
                                    )}
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button className="tt-btn-primary" onClick={saveSlot} disabled={savingSlot} style={{ flex: 1 }}>
                                        {savingSlot ? '…' : 'Save'}
                                      </button>
                                      <button className="tt-btn-ghost" onClick={() => setEditing(null)} style={{ flex: 1 }}>
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={`tt-cell-wrap${editable ? ' editable' : ''}`}
                                    style={{ background: cell.subject && pal ? pal.bg : 'transparent' }}
                                    onClick={() => {
                                      if (editable && !dimmed) {
                                        setEditing([pi, di]);
                                        setEditVal(isAdmin ? (cell.department || '') : (cell.subject || ''));
                                      }
                                    }}
                                    onMouseEnter={() => setHoveredCell([pi, di])}
                                    onMouseLeave={() => setHoveredCell(null)}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      {cell.department ? (
                                        <span className="dept-pill" style={{ background: pal ? pal.bg : '#f3f4f6', border: `1px solid ${pal ? pal.border : '#e5e7eb'}`, color: pal ? pal.text : '#6b7280' }}>
                                          {cell.department}
                                        </span>
                                      ) : <span />}
                                      {editable && isAdmin && (
                                        <span style={{ fontSize: '0.65rem', color: '#d1d5db' }} data-html2canvas-ignore="true">✎</span>
                                      )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {cell.subject ? (
                                        <span className="subject-text" style={{ color: pal ? pal.text : '#1a1a2e' }}>{cell.subject}</span>
                                      ) : editable && !isAdmin ? (
                                        <span className="tt-add-hint" style={{ fontSize: '0.68rem', color: '#a5b4fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }} data-html2canvas-ignore="true">
                                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                          Add subject
                                        </span>
                                      ) : (
                                        <span style={{ color: '#e5e7eb', fontSize: '0.85rem' }}>—</span>
                                      )}
                                    </div>
                                    {isToday && (
                                      <div style={{ height: 2, borderRadius: 2, background: '#fbbf24', opacity: 0.5, marginTop: 'auto' }} data-html2canvas-ignore="true"/>
                                    )}
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
            )}

            {/* Empty state */}
            {!data && !tableLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#9ca3af', gap: 12 }}>
                <div style={{ width: 52, height: 52, background: '#f3f4f6', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                    <rect x="2" y="5" width="24" height="21" rx="3" stroke="#d1d5db" strokeWidth="2"/>
                    <path d="M8 2v6M20 2v6M2 12h24" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="7" y="17" width="4" height="4" rx="1" fill="#d1d5db"/>
                    <rect x="12" y="17" width="4" height="4" rx="1" fill="#d1d5db"/>
                    <rect x="17" y="17" width="4" height="4" rx="1" fill="#d1d5db"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#4b5563', fontSize: '0.9rem' }}>No timetable selected</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 3 }}>Search or pick a class from the dropdown to begin.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ────────────────────────────────────────────────── */}
        <aside style={{
          width: 252, flexShrink: 0,
          background: '#fff', borderLeft: '1px solid #ebebeb',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Sidebar header label */}
          <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid #f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1.2" fill="#d1d5db"/>
              <rect x="8" y="1" width="5" height="5" rx="1.2" fill="#d1d5db"/>
              <rect x="1" y="8" width="5" height="5" rx="1.2" fill="#d1d5db"/>
              <rect x="8" y="8" width="5" height="5" rx="1.2" fill="#d1d5db"/>
            </svg>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Controls</span>
          </div>

          {/* Scrollable content */}
          <div className="side-scroll" style={{ padding: '14px 14px 20px', display: 'flex', flexDirection: 'column' }}>

            {/* ── SEARCH ─────────────────────────────────────────────────── */}
            <SideSection title="Search">
              <div className="sidebar-search">
                <SearchBar onNavigate={handleClassChange} />
              </div>
            </SideSection>

            {/* ── EXPORT ─────────────────────────────────────────────────── */}
            <SideSection title="Export">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button
                  className="side-export-btn"
                  disabled={!data}
                  onClick={downloadPDF}
                  style={{ background: '#1a1a2e', color: '#fff' }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1v8M3.5 6l3 3 3-3M1 10h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Download PDF
                </button>
                <button
                  className="side-export-btn"
                  disabled={!data}
                  onClick={downloadCSV}
                  style={{ background: '#f0fdf4', color: '#15803d', border: '1.5px solid #bbf7d0' }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="1.5" y="1.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                    <line x1="1.5" y1="5" x2="11.5" y2="5" stroke="currentColor" strokeWidth="1.2"/>
                    <line x1="1.5" y1="8" x2="11.5" y2="8" stroke="currentColor" strokeWidth="1.2"/>
                    <line x1="5" y1="1.5" x2="5" y2="11.5" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  Download CSV
                </button>
              </div>
            </SideSection>

            {/* ── DEPT FILTER ────────────────────────────────────────────── */}
            <SideSection title="Filter by Department">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['All', ...DEPARTMENTS].map(d => {
                  const pal      = d !== 'All' ? (DEPT_PALETTE[d] || null) : null;
                  const isActive = deptFilter === d;
                  return (
                    <button key={d} onClick={() => setDeptFilter(d)} style={{
                      padding: '3px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700,
                      border: isActive ? `1.5px solid ${pal ? pal.border : '#4f46e5'}` : '1px solid #e5e7eb',
                      background: isActive ? (pal ? pal.bg : '#e0e7ff') : 'transparent',
                      color: isActive ? (pal ? pal.text : '#4f46e5') : '#6b7280',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif",
                    }}>{d}</button>
                  );
                })}
              </div>
            </SideSection>

            {/* ── STATS ──────────────────────────────────────────────────── */}
            {data ? (
              <SideSection title="Stats">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Mini stat trio */}
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[
                      { label: 'Total', value: totalSlots,              color: '#1a1a2e' },
                      { label: 'Filled', value: filledSlots,            color: '#059669' },
                      { label: 'Free',   value: totalSlots - filledSlots, color: '#f59e0b' },
                    ].map(s => (
                      <div key={s.label} className="mini-stat" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.54rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '1.2rem', fontWeight: 700, color: s.color, lineHeight: 1.1, marginTop: 2 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Fill bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.62rem', color: '#9ca3af' }}>Completion</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#059669' }}>{fillPct}%</span>
                    </div>
                    <div style={{ height: 5, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${fillPct}%`, background: 'linear-gradient(90deg,#059669,#34d399)', borderRadius: 10, transition: 'width 0.5s ease' }}/>
                    </div>
                  </div>

                  {/* Busiest dept */}
                  <div style={{ background: '#f9fafb', border: '1px solid #ebebeb', borderRadius: 9, padding: '7px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', color: '#9ca3af', fontWeight: 600 }}>Busiest dept</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a2e' }}>{topDept}</span>
                  </div>

                  {/* Per-dept bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
                      const pal = DEPT_PALETTE[dept] || DEPT_PALETTE.Common;
                      const pct = totalSlots > 0 ? Math.round(count / totalSlots * 100) : 0;
                      return (
                        <div key={dept}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: pal.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: pal.dot, display: 'inline-block' }}/>
                              {dept}
                            </span>
                            <span style={{ fontSize: '0.58rem', color: '#9ca3af' }}>{count} · {pct}%</span>
                          </div>
                          <div style={{ height: 4, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pal.dot, borderRadius: 10, opacity: 0.7, transition: 'width 0.5s ease' }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* StatsPanel toggle */}
                  <button
                    onClick={() => setShowStatsPanel(s => !s)}
                    style={{
                      width: '100%', padding: '7px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
                      border: '1.5px solid #e5e7eb', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                      background: showStatsPanel ? '#ede9fe' : '#f9fafb',
                      color: showStatsPanel ? '#7c3aed' : '#6b7280',
                      transition: 'all 0.15s', marginTop: 2,
                    }}
                  >
                    {showStatsPanel ? '▲ Hide full stats' : '▼ Show full stats'}
                  </button>
                  {showStatsPanel && (
                    <div style={{ marginTop: 6 }}>
                      <StatsPanel currentClassId={classId} />
                    </div>
                  )}
                </div>
              </SideSection>
            ) : (
              <SideSection title="Stats">
                <div style={{ background: '#f9fafb', border: '1px dashed #e5e7eb', borderRadius: 10, padding: '18px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '0.72rem' }}>
                  Select a class to see stats
                </div>
              </SideSection>
            )}

          </div>
        </aside>
      </div>
    </div>
  );
}
