import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchTimetable } from './api';

const DEPT_COLORS = {
  CSE: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  ECE: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  MECH: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  MATH: { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
  PHYSICS: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  Common: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
};

function getDeptColor(dept) {
  return DEPT_COLORS[dept] || DEPT_COLORS.Common;
}

export default function SearchBar({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchTimetable(query.trim());
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (result) => {
    setQuery('');
    setOpen(false);
    if (onNavigate) onNavigate(result.classId);
    else navigate(`/timetable?classId=${result.classId}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.classId]) acc[r.classId] = [];
    acc[r.classId].push(r);
    return acc;
  }, {});

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search subject or department..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <span className="search-spinner" />}
        {query && (
          <button className="search-clear" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}>×</button>
        )}
      </div>

      {open && (
        <div className="search-dropdown">
          {results.length === 0 ? (
            <div className="search-empty">No results for "{query}"</div>
          ) : (
            <>
              <div className="search-meta">{results.length} result{results.length !== 1 ? 's' : ''} found</div>
              {Object.entries(grouped).map(([classId, items]) => (
                <div key={classId}>
                  <div className="search-group-header">📚 Class {classId}</div>
                  {items.map((r, i) => {
                    const colors = getDeptColor(r.department);
                    return (
                      <button key={i} className="search-result-item" onClick={() => handleSelect(r)}>
                        <div className="search-result-left">
                          <span
                            className="search-dept-badge"
                            style={{ background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}
                          >
                            {r.department}
                          </span>
                          <span className="search-subject">
                            {r.subject || <em style={{ color: '#94a3b8' }}>No subject assigned</em>}
                          </span>
                        </div>
                        <div className="search-result-right">
                          <span className="search-slot-info">{r.day} · P{r.period}</span>
                          <span className="search-time">{r.timeSlot}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
