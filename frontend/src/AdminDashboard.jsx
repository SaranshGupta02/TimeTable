import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from './NotificationContext';
import * as api from './api';


/* ─── palette (mirrors Timetable dept colours) ───────────────────────────── */
const DEPT_PALETTE = {
  CSE:     { bg:'#e8f4fd', border:'#3b9ede', text:'#1a5f8a', dot:'#3b9ede' },
  ECE:     { bg:'#fdf0e8', border:'#e8863b', text:'#8a4a1a', dot:'#e8863b' },
  MECH:    { bg:'#edf7ed', border:'#3bba5e', text:'#1a6b31', dot:'#3bba5e' },
  MATH:    { bg:'#f3eeff', border:'#9b6de8', text:'#4e2a9a', dot:'#9b6de8' },
  PHYSICS: { bg:'#fff0f3', border:'#e8476a', text:'#8a1a33', dot:'#e8476a' },
  Common:  { bg:'#f0fafa', border:'#3bbaba', text:'#1a6b6b', dot:'#3bbaba' },
};
const deptPal = (d) => DEPT_PALETTE[d] || { bg:'#f3f4f6', border:'#9ca3af', text:'#374151', dot:'#9ca3af' };

const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

/* ─── tiny icon components ───────────────────────────────────────────────── */
const Icon = ({ d, size=16, stroke='currentColor', strokeWidth=1.6, fill='none' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

function AdminDashboard() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');

  const [users,        setUsers]        = useState([]);
  const [classes,      setClasses]      = useState([]);
  const [activeSection,setActiveSection]= useState('overview');
  const [showAddClass, setShowAddClass] = useState(false);
  const [search,       setSearch]       = useState('');
  const [userFilter,   setUserFilter]   = useState('all'); // all | pending | active
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!token || user.role !== 'admin') { navigate('/admin-login'); return; }
    document.body.style.background = '#f0f2f5';
    Promise.all([fetchUsers(), fetchClasses()]).finally(() => setLoading(false));
    return () => { document.body.style.background = ''; };
  }, []);

  const fetchUsers = async () => {
    try { setUsers(await api.getUsers()); }
    catch (err) { showNotification(err.message, 'error'); }
  };
  const fetchClasses = async () => {
    try { setClasses(await api.getClasses()); }
    catch (err) { showNotification(err.message, 'error'); }
  };

  const handleApproval = async (userId, approve) => {
    try {
      await api.approveUser(userId, approve);
      showNotification(approve ? 'Professor approved' : 'Access revoked', approve ? 'success' : 'warning');
      fetchUsers();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const handleDeleteClass = async (e, classId) => {
    e.stopPropagation();
    if (!window.confirm(`Delete class ${classId}?\nAll schedule data will be permanently removed.`)) return;
    try {
      await api.deleteClass(classId);
      showNotification(`Class ${classId} deleted`, 'success');
      fetchClasses();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const logout = () => { localStorage.clear(); window.location.href = '/admin-login'; };

  /* derived stats */
  const pendingCount = users.filter(u => !u.is_approved).length;
  const activeCount  = users.filter(u => u.is_approved).length;
  const deptMap      = users.reduce((acc, u) => { acc[u.department] = (acc[u.department]||0)+1; return acc; }, {});
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = userFilter === 'all' || (userFilter === 'pending' ? !u.is_approved : u.is_approved);
    return matchSearch && matchFilter;
  });

  const NAV = [
    { id:'overview',  label:'Overview',   icon:'M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zM3 10a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6zM14 9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9z' },
    { id:'classes',   label:'Classes',    icon:'M9 4.804A7.968 7.968 0 0 0 5.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0 1 5.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0 1 14.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0 0 14.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 1 1-2 0V4.804z' },
    { id:'professors',label:'Professors', icon:'M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z' },
  ];

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#f0f2f5', flexDirection:'column', gap:'1rem', fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width:36, height:36, border:'3px solid #e0e0e0', borderTop:'3px solid #1a1a2e', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <span style={{ color:'#888', fontSize:'0.85rem', letterSpacing:'0.05em' }}>LOADING DASHBOARD</span>
    </div>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f0f2f5', fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }

        .adm-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px; border-radius: 10px;
          font-size: 0.875rem; font-weight: 500;
          color: #6b7280; cursor: pointer; transition: all 0.15s;
          border: none; background: transparent; width: 100%;
          font-family: 'DM Sans', sans-serif;
        }
        .adm-nav-item:hover { background: #f3f4f6; color: #1a1a2e; }
        .adm-nav-item.active { background: #1a1a2e; color: #fff; }
        .adm-nav-item.active svg { stroke: #ffdd57; }

        .stat-card-adm {
          background: #fff; border-radius: 16px; padding: 20px 22px;
          border: 1px solid #ebebeb; flex: 1; min-width: 0;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .stat-card-adm:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }

        .class-card-adm {
          background: #fff; border-radius: 14px; padding: 18px 20px;
          border: 1px solid #ebebeb; cursor: pointer; transition: all 0.18s;
          position: relative; display: flex; flex-direction: column; gap: 6px;
        }
        .class-card-adm:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); border-color: #1a1a2e20; }

        .adm-table { width: 100%; border-collapse: collapse; }
        .adm-th { padding: 11px 14px; text-align: left; font-size: 0.68rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #ebebeb; background: #fafafa; }
        .adm-td { padding: 13px 14px; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; color: #1a1a2e; vertical-align: middle; }
        .adm-tr:last-child .adm-td { border-bottom: none; }
        .adm-tr:hover .adm-td { background: #fafafe; }

        .adm-btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; background: #1a1a2e; color: #fff;
          border: none; border-radius: 9px; font-family: 'DM Sans', sans-serif;
          font-size: 0.83rem; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s;
        }
        .adm-btn-primary:hover { background: #2d2d4e; }
        .adm-btn-primary:active { transform: scale(0.98); }

        .adm-btn-danger {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 13px; background: #fef2f2; color: #dc2626;
          border: 1px solid #fecaca; border-radius: 8px; font-family: 'DM Sans', sans-serif;
          font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .adm-btn-danger:hover { background: #fee2e2; border-color: #fca5a5; }

        .adm-btn-success {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 13px; background: #f0fdf4; color: #15803d;
          border: 1px solid #bbf7d0; border-radius: 8px; font-family: 'DM Sans', sans-serif;
          font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .adm-btn-success:hover { background: #dcfce7; }

        .adm-btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; background: transparent; color: #6b7280;
          border: 1.5px solid #e5e7eb; border-radius: 9px; font-family: 'DM Sans', sans-serif;
          font-size: 0.83rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .adm-btn-ghost:hover { background: #f9fafb; border-color: #d0d5e8; color: #1a1a2e; }

        .adm-input {
          width: 100%; padding: 9px 13px; background: #f9fafb;
          border: 1.5px solid #e5e7eb; border-radius: 9px; color: #1a1a2e;
          font-family: 'DM Sans', sans-serif; font-size: 0.875rem; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .adm-input:focus { border-color: #1a1a2e; box-shadow: 0 0 0 3px rgba(26,26,46,0.06); background: #fff; }

        .adm-search {
          padding: 8px 12px 8px 36px; background: #fff;
          border: 1.5px solid #e5e7eb; border-radius: 9px; color: #1a1a2e;
          font-family: 'DM Sans', sans-serif; font-size: 0.875rem; outline: none;
          transition: border-color 0.15s; width: 240px;
        }
        .adm-search:focus { border-color: #1a1a2e; }

        .dept-pill-adm {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 9px; border-radius: 20px;
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
        }

        .filter-chip {
          padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;
          border: 1.5px solid #e5e7eb; background: transparent; color: #6b7280;
          cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
        }
        .filter-chip.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }

        .modal-bg {
          position: fixed; inset: 0; background: rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal-box {
          background: #fff; border-radius: 20px; padding: 28px 30px;
          width: 540px; max-width: 95vw; max-height: 90vh; overflow-y: auto;
          box-shadow: 0 24px 60px rgba(0,0,0,0.15);
          animation: modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes modalIn { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fu { animation: fadeUp 0.25s ease forwards; }

        .adm-logout {
          padding: 7px 14px; background: transparent; color: #6b7280;
          border: 1.5px solid #e5e7eb; border-radius: 8px; font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .adm-logout:hover { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }

        .progress-bar { height: 6px; border-radius: 3px; background: #f3f4f6; overflow: hidden; margin-top: 8px; }
        .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 3px; }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{ width:220, flexShrink:0, background:'#fff', borderRight:'1px solid #ebebeb', display:'flex', flexDirection:'column', padding:'20px 14px', gap:4, position:'sticky', top:0, height:'100vh', overflow:'auto' }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 8px 20px' }}>
          <img
            src="/logo.png"
            alt="NIT Kurukshetra"
            style={{ width:38, height:38, objectFit:'contain', flexShrink:0 }}
            onError={e => { e.target.style.display='none'; }}
          />
          <div>
            <div style={{ fontWeight:800, fontSize:'0.72rem', color:'#1a1a2e', letterSpacing:'0.01em', lineHeight:1.2 }}>NIT KURUKSHETRA</div>
            <div style={{ fontSize:'0.63rem', color:'#7c3aed', fontWeight:600, marginTop:1, lineHeight:1.2 }}>Timetable System</div>
            <div style={{ fontSize:'0.55rem', color:'#9ca3af', fontWeight:500, marginTop:1 }}>Admin Console</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
          {NAV.map(n => (
            <button key={n.id} className={`adm-nav-item${activeSection===n.id?' active':''}`} onClick={() => setActiveSection(n.id)}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill={activeSection===n.id?'#ffdd57':'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon}/>
              </svg>
              {n.label}
              {n.id==='professors' && pendingCount > 0 && (
                <span style={{ marginLeft:'auto', background:'#ef4444', color:'#fff', borderRadius:20, fontSize:'0.65rem', fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom: user */}
        <div style={{ borderTop:'1px solid #f3f4f6', paddingTop:16, marginTop:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
            <div style={{ width:30, height:30, background:'#1a1a2e', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:700, color:'#fff', flexShrink:0 }}>
              {(user.name||user.email||'A').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name||user.email?.split('@')[0]}</div>
              <div style={{ fontSize:'0.65rem', color:'#9ca3af' }}>Administrator</div>
            </div>
          </div>
          <button className="adm-logout" style={{ width:'100%', justifyContent:'center', display:'flex', alignItems:'center', gap:6 }} onClick={logout}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3M13 15l4-5-4-5M17 10H7"/></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex:1, overflow:'auto', padding:'28px 28px 40px' }}>

        {/* ══ OVERVIEW ═══════════════════════════════════════════════════════ */}
        {activeSection === 'overview' && (
          <div className="animate-fu">
            {/* Institutional banner */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #312e81 100%)',
              borderRadius: 14, padding: '16px 22px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <img src="/logo.png" alt="NIT KKR" style={{ width:50, height:50, objectFit:'contain', flexShrink:0 }} onError={e => { e.target.style.display='none'; }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#fff', letterSpacing:'0.03em', lineHeight:1.3 }}>DEPARTMENT OF COMPUTER ENGINEERING</div>
                <div style={{ fontWeight:700, fontSize:'0.8rem', color:'#a5b4fc', letterSpacing:'0.04em', lineHeight:1.4 }}>NATIONAL INSTITUTE OF TECHNOLOGY, KURUKSHETRA</div>
                <div style={{ fontSize:'0.7rem', color:'#93c5fd', marginTop:3, fontWeight:500 }}>Academic Timetable Management &bull; Even Semester 2024-25</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'0.7rem', color:'#94a3b8' }}>Admin Dashboard</div>
                <div style={{ fontWeight:700, fontSize:'0.85rem', color:'#ffdd57', marginTop:2 }}>{user.name?.split(' ')[0] || 'Admin'}</div>
              </div>
            </div>

            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'#1a1a2e', letterSpacing:'-0.02em' }}>Overview</h1>
              <p style={{ color:'#9ca3af', fontSize:'0.875rem', marginTop:4 }}>Good {new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, {user.name?.split(' ')[0]||'Admin'}.</p>
            </div>

            {/* Stat cards */}
            <div style={{ display:'flex', gap:14, marginBottom:24, flexWrap:'wrap' }}>
              {[
                { label:'Total classes',    value:classes.length,  sub:`${classes.length} active`,       color:'#1a1a2e', icon:'M9 4.804A7.968 7.968 0 0 0 5.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0 1 5.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0 1 14.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0 0 14.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 1 1-2 0V4.804z' },
                { label:'Professors',       value:users.length,    sub:`${activeCount} active`,           color:'#059669', icon:'M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z' },
                { label:'Pending approvals',value:pendingCount,    sub:'awaiting review',                 color: pendingCount>0?'#dc2626':'#059669', icon:'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
                { label:'Departments',      value:Object.keys(deptMap).length, sub:'represented', color:'#7c3aed', icon:'M7 3a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2H7zM4 7a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zM2 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z' },
              ].map((s, i) => (
                <div key={i} className="stat-card-adm" style={{ animationDelay:`${i*0.05}s` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</div>
                    <div style={{ width:30, height:30, background:'#f3f4f6', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke={s.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}/></svg>
                    </div>
                  </div>
                  <div style={{ fontFamily:"'DM Mono', monospace", fontSize:'1.9rem', fontWeight:500, color:s.color, letterSpacing:'-0.03em', marginTop:10 }}>{s.value}</div>
                  <div style={{ fontSize:'0.75rem', color:'#9ca3af', marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Two-column: dept breakdown + recent classes */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, flexWrap:'wrap' }}>
              {/* Dept breakdown */}
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #ebebeb', padding:22 }}>
                <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>Department breakdown</div>
                {Object.entries(deptMap).length === 0
                  ? <div style={{ color:'#d1d5db', fontSize:'0.875rem', textAlign:'center', padding:'20px 0' }}>No professors yet</div>
                  : Object.entries(deptMap).sort((a,b)=>b[1]-a[1]).map(([dept, count]) => {
                      const pal = deptPal(dept);
                      const pct = users.length ? Math.round(count/users.length*100) : 0;
                      return (
                        <div key={dept} style={{ marginBottom:14 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                            <span className="dept-pill-adm" style={{ background:pal.bg, border:`1px solid ${pal.border}`, color:pal.text }}>
                              <span style={{ width:5, height:5, borderRadius:'50%', background:pal.dot, display:'inline-block' }}/>
                              {dept}
                            </span>
                            <span style={{ fontFamily:"'DM Mono', monospace", fontSize:'0.8rem', color:'#6b7280' }}>{count} <span style={{ color:'#d1d5db' }}>/ {users.length}</span></span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width:`${pct}%`, background:pal.dot }}/>
                          </div>
                        </div>
                      );
                    })
                }
              </div>

              {/* Quick actions + recent classes */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #ebebeb', padding:22 }}>
                  <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Quick actions</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <button className="adm-btn-primary" onClick={() => { setShowAddClass(true); }} style={{ justifyContent:'center' }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
                      Add new class
                    </button>
                    <button className="adm-btn-ghost" onClick={() => setActiveSection('professors')} style={{ justifyContent:'center', position:'relative' }}>
                      Review pending approvals
                      {pendingCount > 0 && <span style={{ position:'absolute', right:12, background:'#ef4444', color:'#fff', borderRadius:20, fontSize:'0.65rem', fontWeight:700, padding:'1px 7px' }}>{pendingCount}</span>}
                    </button>
                    <button className="adm-btn-ghost" onClick={() => setActiveSection('classes')} style={{ justifyContent:'center' }}>
                      Manage class timetables
                    </button>
                  </div>
                </div>

                {/* Approval status */}
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #ebebeb', padding:22 }}>
                  <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Approval status</div>
                  <div style={{ display:'flex', gap:12 }}>
                    {[
                      { label:'Active',  val:activeCount,  bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
                      { label:'Pending', val:pendingCount, bg:'#fef9c3', color:'#a16207', border:'#fde68a' },
                    ].map(s => (
                      <div key={s.label} style={{ flex:1, background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:'14px 16px', textAlign:'center' }}>
                        <div style={{ fontFamily:"'DM Mono', monospace", fontSize:'1.6rem', fontWeight:500, color:s.color }}>{s.val}</div>
                        <div style={{ fontSize:'0.72rem', color:s.color, fontWeight:600, marginTop:3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ CLASSES ════════════════════════════════════════════════════════ */}
        {activeSection === 'classes' && (
          <div className="animate-fu">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
              <div>
                <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'#1a1a2e', letterSpacing:'-0.02em' }}>Classes</h1>
                <p style={{ color:'#9ca3af', fontSize:'0.875rem', marginTop:4 }}>{classes.length} class {classes.length===1?'group':'groups'} configured</p>
              </div>
              <button className="adm-btn-primary" onClick={() => setShowAddClass(true)}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
                Add class
              </button>
            </div>

            {classes.length === 0 ? (
              <EmptyState icon="M9 4.804A7.968 7.968 0 0 0 5.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0 1 5.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0 1 14.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0 0 14.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 1 1-2 0V4.804z" title="No classes yet" sub="Create your first class to get started." />
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:14 }}>
                {classes.map(c => (
                  <div key={c} className="class-card-adm" onClick={() => navigate(`/timetable?classId=${c}&mode=structure`)}>
                    {/* colour accent strip */}
                    <div style={{ height:4, borderRadius:2, background:'#1a1a2e', marginBottom:12, width:32 }}/>
                    <div style={{ fontFamily:"'DM Mono', monospace", fontSize:'1.35rem', fontWeight:500, color:'#1a1a2e', letterSpacing:'-0.01em' }}>{c}</div>
                    <div style={{ fontSize:'0.78rem', color:'#9ca3af', marginTop:2 }}>View timetable →</div>
                    <button
                      className="adm-btn-danger"
                      onClick={e => handleDeleteClass(e, c)}
                      style={{ position:'absolute', top:14, right:14, padding:'4px 8px', fontSize:'0.7rem' }}
                      title="Delete class"
                    >
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h14M8 6V4h4v2M19 6l-1 12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2L1 6"/></svg>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ PROFESSORS ═════════════════════════════════════════════════════ */}
        {activeSection === 'professors' && (
          <div className="animate-fu">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'#1a1a2e', letterSpacing:'-0.02em' }}>Professors</h1>
                <p style={{ color:'#9ca3af', fontSize:'0.875rem', marginTop:4 }}>{users.length} registered · {pendingCount} pending</p>
              </div>
              {/* Search + filter */}
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ position:'relative' }}>
                  <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="5"/><path d="M17 17l-4-4"/></svg>
                  <input className="adm-search" placeholder="Search professors…" value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
                {['all','pending','active'].map(f => (
                  <button key={f} className={`filter-chip${userFilter===f?' active':''}`} onClick={() => setUserFilter(f)}>
                    {f.charAt(0).toUpperCase()+f.slice(1)}
                    {f==='pending' && pendingCount>0 && <span style={{ marginLeft:4, background:userFilter==='pending'?'#fff':'#ef4444', color:userFilter==='pending'?'#ef4444':'#fff', borderRadius:20, fontSize:'0.6rem', fontWeight:700, padding:'0 5px' }}>{pendingCount}</span>}
                  </button>
                ))}
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <EmptyState icon="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" title="No professors found" sub={search ? "Try a different search." : "No professors match this filter."} />
            ) : (
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #ebebeb', overflow:'hidden' }}>
                <table className="adm-table">
                  <thead>
                    <tr>
                      {['Professor','Email','Department','Status','Action'].map(h => (
                        <th key={h} className="adm-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => {
                      const pal = deptPal(u.department);
                      const initials = (u.name||u.email||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
                      return (
                        <tr key={u.id} className="adm-tr">
                          <td className="adm-td">
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:32, height:32, background:'#f3f4f6', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:'#6b7280', flexShrink:0 }}>{initials}</div>
                              <span style={{ fontWeight:600, color:'#1a1a2e' }}>{u.name}</span>
                            </div>
                          </td>
                          <td className="adm-td" style={{ color:'#6b7280', fontFamily:"'DM Mono', monospace", fontSize:'0.8rem' }}>{u.email}</td>
                          <td className="adm-td">
                            <span className="dept-pill-adm" style={{ background:pal.bg, border:`1px solid ${pal.border}`, color:pal.text }}>
                              <span style={{ width:5, height:5, borderRadius:'50%', background:pal.dot, display:'inline-block' }}/>
                              {u.department}
                            </span>
                          </td>
                          <td className="adm-td">
                            <span style={{
                              padding:'3px 10px', borderRadius:20, fontSize:'0.7rem', fontWeight:700,
                              textTransform:'uppercase', letterSpacing:'0.04em',
                              background: u.is_approved ? '#f0fdf4' : '#fef9c3',
                              color:       u.is_approved ? '#15803d' : '#a16207',
                              border:      u.is_approved ? '1px solid #bbf7d0' : '1px solid #fde68a'
                            }}>
                              {u.is_approved ? 'Active' : 'Pending'}
                            </span>
                          </td>
                          <td className="adm-td">
                            {!u.is_approved ? (
                              <button className="adm-btn-success" onClick={() => handleApproval(u.id, true)}>
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10l5 5 8-8"/></svg>
                                Approve
                              </button>
                            ) : (
                              <button className="adm-btn-danger" onClick={() => handleApproval(u.id, false)}>
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Add Class Modal ─────────────────────────────────────────────────── */}
      {showAddClass && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setShowAddClass(false); }}>
          <div className="modal-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
              <div>
                <h2 style={{ fontWeight:700, fontSize:'1.15rem', color:'#1a1a2e', letterSpacing:'-0.01em' }}>New class group</h2>
                <p style={{ color:'#9ca3af', fontSize:'0.8rem', marginTop:2 }}>Configure class ID, days, and time slots</p>
              </div>
              <button onClick={() => setShowAddClass(false)} style={{ width:30, height:30, borderRadius:8, border:'1.5px solid #e5e7eb', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:'1rem' }}>×</button>
            </div>
            <AddClassForm
              onCancel={() => setShowAddClass(false)}
              onSuccess={() => { setShowAddClass(false); fetchClasses(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 20px', gap:14, color:'#9ca3af' }}>
      <div style={{ width:56, height:56, background:'#f3f4f6', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontWeight:600, color:'#4b5563', fontSize:'0.95rem' }}>{title}</div>
        <div style={{ fontSize:'0.83rem', marginTop:4 }}>{sub}</div>
      </div>
    </div>
  );
}

/* ─── Add Class Form ──────────────────────────────────────────────────────── */
function AddClassForm({ onCancel, onSuccess }) {
  const { showNotification } = useNotification();
  const [classId,   setClassId]   = useState('');
  const [periods,   setPeriods]   = useState(8);
  const [days,      setDays]      = useState(['Monday','Tuesday','Wednesday','Thursday','Friday']);
  const [timeSlots, setTimeSlots] = useState([]);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    setTimeSlots(prev => {
      const next = [];
      for (let i = 0; i < periods; i++) next.push(prev[i] || `${i + 9}:00 - ${i + 10}:00`);
      return next;
    });
  }, [periods]);

  const toggleDay = d => setDays(prev =>
    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a,b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
  );

  const handleSubmit = async () => {
    if (!classId.trim()) return showNotification('Class ID is required', 'warning');
    if (days.length === 0) return showNotification('Select at least one day', 'warning');
    setSaving(true);
    try {
      await api.createClass(classId.trim().toUpperCase(), days, periods, timeSlots);
      showNotification(`Class ${classId.toUpperCase()} created`, 'success');
      onSuccess();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Class ID */}
      <div>
        <label style={{ display:'block', marginBottom:6, fontSize:'0.78rem', fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>Class ID</label>
        <input className="adm-input" value={classId} onChange={e => setClassId(e.target.value)} placeholder="e.g. E301, CSE-A, 3rd-Sem" autoFocus onKeyDown={e => e.key==='Enter' && handleSubmit()}/>
      </div>

      {/* Periods slider */}
      <div>
        <label style={{ display:'block', marginBottom:8, fontSize:'0.78rem', fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>
          Periods per day — <span style={{ fontFamily:"'DM Mono', monospace", color:'#1a1a2e', fontSize:'0.9rem' }}>{periods}</span>
        </label>
        <input type="range" min="1" max="12" value={periods} onChange={e => setPeriods(+e.target.value)} style={{ width:'100%', accentColor:'#1a1a2e' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.68rem', color:'#d1d5db', marginTop:3 }}>
          <span>1</span><span>12</span>
        </div>
      </div>

      {/* Days */}
      <div>
        <label style={{ display:'block', marginBottom:8, fontSize:'0.78rem', fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>Days</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {ALL_DAYS.map(day => (
            <button key={day} onClick={() => toggleDay(day)}
              style={{
                padding:'5px 13px', borderRadius:20, fontSize:'0.78rem', fontWeight:600,
                border: days.includes(day) ? '1.5px solid #1a1a2e' : '1.5px solid #e5e7eb',
                background: days.includes(day) ? '#1a1a2e' : 'transparent',
                color: days.includes(day) ? '#fff' : '#6b7280',
                cursor:'pointer', transition:'all 0.15s', fontFamily:"'DM Sans', sans-serif"
              }}
            >{day.slice(0,3)}</button>
          ))}
        </div>
      </div>

      {/* Time slots */}
      <div>
        <label style={{ display:'block', marginBottom:8, fontSize:'0.78rem', fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>Time slots</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxHeight:200, overflowY:'auto', paddingRight:4 }}>
          {timeSlots.map((slot, i) => (
            <div key={i} style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontFamily:"'DM Mono', monospace", fontSize:'0.65rem', color:'#d1d5db', fontWeight:500 }}>{String(i+1).padStart(2,'0')}</span>
              <input
                className="adm-input"
                value={slot}
                onChange={e => { const n=[...timeSlots]; n[i]=e.target.value; setTimeSlots(n); }}
                style={{ paddingLeft:30, fontSize:'0.8rem', padding:'7px 10px 7px 28px' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:10, paddingTop:4 }}>
        <button className="adm-btn-primary" onClick={handleSubmit} disabled={saving} style={{ flex:1, justifyContent:'center' }}>
          {saving ? 'Creating…' : 'Create class'}
        </button>
        <button className="adm-btn-ghost" onClick={onCancel} style={{ flex:1, justifyContent:'center' }}>Cancel</button>
      </div>
    </div>
  );
}

export default AdminDashboard;
