import { useState, useEffect } from 'react';
import { getStats } from './api';

const DEPT_COLORS = {
  CSE: { bg: '#eff6ff', color: '#1d4ed8', bar: '#3b82f6' },
  ECE: { bg: '#f0fdf4', color: '#15803d', bar: '#22c55e' },
  MECH: { bg: '#fff7ed', color: '#c2410c', bar: '#f97316' },
  MATH: { bg: '#fdf4ff', color: '#7e22ce', bar: '#a855f7' },
  PHYSICS: { bg: '#fef2f2', color: '#b91c1c', bar: '#ef4444' },
  Common: { bg: '#f8fafc', color: '#475569', bar: '#94a3b8' },
};

function getDeptColor(dept) {
  return DEPT_COLORS[dept] || { bg: '#f8fafc', color: '#475569', bar: '#94a3b8' };
}

export default function StatsPanel({ currentClassId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="stats-panel">
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '80px', flex: 1, borderRadius: '12px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { overall, byClass, byDepartment } = stats;
  const currentClass = byClass.find(c => c.classId === currentClassId);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'departments', label: '🏷️ Departments' },
    { id: 'classes', label: '📚 Classes' },
  ];

  return (
    <div className="stats-panel">
      {/* Tab bar */}
      <div className="stats-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`stats-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="stats-grid">
          <div className="stats-card">
            <div className="stats-card-label">Total Slots</div>
            <div className="stats-card-value">{overall.totalSlots}</div>
            <div className="stats-card-sub">across all classes</div>
          </div>
          <div className="stats-card">
            <div className="stats-card-label">Filled</div>
            <div className="stats-card-value" style={{ color: '#10b981' }}>{overall.filledSlots}</div>
            <div className="stats-card-sub">{overall.pct}% complete</div>
          </div>
          <div className="stats-card">
            <div className="stats-card-label">Empty</div>
            <div className="stats-card-value" style={{ color: '#f59e0b' }}>{overall.totalSlots - overall.filledSlots}</div>
            <div className="stats-card-sub">awaiting subjects</div>
          </div>
          {currentClass && (
            <div className="stats-card" style={{ borderLeft: '3px solid #4f46e5' }}>
              <div className="stats-card-label">This Class ({currentClass.classId})</div>
              <div className="stats-card-value" style={{ color: '#4f46e5' }}>{currentClass.pct}%</div>
              <div className="stats-card-sub">{currentClass.filled}/{currentClass.total} filled</div>
            </div>
          )}
        </div>
      )}

      {/* Departments tab */}
      {activeTab === 'departments' && (
        <div className="stats-dept-list">
          {byDepartment.map(dept => {
            const colors = getDeptColor(dept.department);
            const pct = dept.totalSlots > 0 ? Math.round((dept.filledSlots / dept.totalSlots) * 100) : 0;
            return (
              <div key={dept.department} className="stats-dept-row">
                <div className="stats-dept-header">
                  <span className="stats-dept-badge" style={{ background: colors.bg, color: colors.color }}>
                    {dept.department}
                  </span>
                  <span className="stats-dept-nums">
                    {dept.filledSlots}/{dept.totalSlots} slots · {pct}%
                  </span>
                </div>
                <div className="stats-bar-track">
                  <div
                    className="stats-bar-fill"
                    style={{ width: `${pct}%`, background: colors.bar }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Classes tab */}
      {activeTab === 'classes' && (
        <div className="stats-dept-list">
          {byClass.map(cls => (
            <div key={cls.classId} className="stats-dept-row">
              <div className="stats-dept-header">
                <span className="stats-dept-badge" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                  {cls.classId}
                </span>
                <span className="stats-dept-nums">
                  {cls.filled}/{cls.total} · {cls.pct}%
                </span>
              </div>
              <div className="stats-bar-track">
                <div
                  className="stats-bar-fill"
                  style={{
                    width: `${cls.pct}%`,
                    background: cls.pct >= 80 ? '#10b981' : cls.pct >= 40 ? '#f59e0b' : '#ef4444'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
