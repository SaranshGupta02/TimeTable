import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pool, { initDb } from './db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const PORT = process.env.PORT || 4000;
const app = express();

// --- Core Middleware ---
app.use(compression()); // Gzip all responses
app.use(cors());
app.use(express.json());

// --- Rate Limiting (auth routes only) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = 8;

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ============================================================
// HEALTH CHECK — for frontend cold-start ping
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Timetable Management System API', version: '2.0', status: 'running' });
});

// ============================================================
// AUTH ROUTES
// ============================================================

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password, name, department } = req.body;

  if (!email || !email.endsWith('@nitkkr.ac.in')) {
    return res.status(400).json({ error: 'Only @nitkkr.ac.in emails are allowed' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    await pool.query(`
      INSERT INTO users (email, password_hash, role, department, name)
      VALUES ($1, $2, 'professor', $3, $4)
    `, [email, passwordHash, department, name]);

    res.json({ success: true, message: 'Registration successful. Waiting for admin approval.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Token expires in 8 hours (matches frontend session logic)
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      is_approved: user.is_approved ? 1 : 0,
      name: user.name
    }, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        is_approved: user.is_approved ? 1 : 0
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, email, name, department, role, is_approved, created_at
      FROM users 
      WHERE role = 'professor'
      ORDER BY created_at DESC
    `);
    const users = rows.map(u => ({ ...u, is_approved: u.is_approved ? 1 : 0 }));
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/approve', authMiddleware, adminMiddleware, async (req, res) => {
  const { userId, approve } = req.body;
  try {
    const { rowCount } = await pool.query(
      'UPDATE users SET is_approved = $1 WHERE id = $2',
      [approve ? true : false, userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, is_approved: approve });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.post('/api/admin/classes', authMiddleware, adminMiddleware, async (req, res) => {
  const { classId, days, periods, timeSlots } = req.body;

  if (!classId) return res.status(400).json({ error: 'classId is required' });

  const daysArray = days && days.length > 0 ? days : DAYS;
  const numPeriods = periods ? parseInt(periods) : PERIODS;
  const timeSlotsArray = timeSlots && timeSlots.length > 0 ? timeSlots :
    Array.from({ length: numPeriods }, (_, i) => `${i + 9}:00 - ${i + 10}:00`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT class_id FROM timetable_classes WHERE class_id = $1', [classId]);
    if (rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Class already exists' });
    }

    await client.query(
      'INSERT INTO timetable_classes (class_id, days, periods, time_slots) VALUES ($1, $2, $3, $4)',
      [classId, JSON.stringify(daysArray), numPeriods, JSON.stringify(timeSlotsArray)]
    );

    // Batch insert slots
    const initDept = 'Common';
    let values = [];
    let placeholders = [];
    let counter = 1;

    for (let p = 0; p < numPeriods; p++) {
      for (let d = 0; d < daysArray.length; d++) {
        placeholders.push(`($${counter++}, $${counter++}, $${counter++}, $${counter++}, '')`);
        values.push(classId, p, d, initDept);
      }
    }

    await client.query(
      `INSERT INTO timetable_slots (class_id, period_index, day_index, department, subject) VALUES ${placeholders.join(', ')}`,
      values
    );

    await client.query('COMMIT');
    res.json({ success: true, classId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create Class Error:', err);
    res.status(500).json({ error: 'Failed to create class' });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/classes/:classId', authMiddleware, adminMiddleware, async (req, res) => {
  const { classId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM timetable_slots WHERE class_id = $1', [classId]);
    const result = await client.query('DELETE FROM timetable_classes WHERE class_id = $1', [classId]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found' });
    }
    await client.query('COMMIT');
    res.json({ success: true, message: `Class ${classId} deleted successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete Class Error:', err);
    res.status(500).json({ error: 'Failed to delete class' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/reset-db', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS timetable_slots CASCADE');
    await client.query('DROP TABLE IF EXISTS timetable_classes CASCADE');
    await initDb();
    res.json({ success: true, message: 'Database reset successfully' });
  } catch (err) {
    console.error('Reset DB Error:', err);
    res.status(500).json({ error: 'Failed to reset database' });
  } finally {
    client.release();
  }
});

// ============================================================
// TIMETABLE ROUTES
// ============================================================

app.get('/api/classes', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT class_id FROM timetable_classes ORDER BY class_id');
    res.json({ classes: rows.map(r => r.class_id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

app.get('/api/timetable/:classId', authMiddleware, async (req, res) => {
  const { classId } = req.params;

  try {
    // Run both queries in parallel
    const [clsResult, slotsResult] = await Promise.all([
      pool.query('SELECT class_id, days, periods, time_slots FROM timetable_classes WHERE class_id = $1', [classId]),
      pool.query('SELECT period_index, day_index, department, subject FROM timetable_slots WHERE class_id = $1', [classId])
    ]);

    if (clsResult.rows.length === 0) return res.status(404).json({ error: 'Class not found' });

    const classInfo = clsResult.rows[0];
    const classDays = classInfo.days ? JSON.parse(classInfo.days) : DAYS;
    const classPeriods = classInfo.periods || PERIODS;
    const classTimeSlots = classInfo.time_slots ? JSON.parse(classInfo.time_slots) :
      Array.from({ length: classPeriods }, (_, i) => `${i + 9}:00 - ${i + 10}:00`);

    // Build O(1) lookup map instead of O(n²) find()
    const slotMap = {};
    for (const row of slotsResult.rows) {
      slotMap[`${row.period_index}_${row.day_index}`] = row;
    }

    const grid = [];
    for (let p = 0; p < classPeriods; p++) {
      const row = [];
      for (let d = 0; d < classDays.length; d++) {
        const slot = slotMap[`${p}_${d}`];
        row.push({
          department: slot ? slot.department : 'Common',
          subject: slot ? slot.subject : ''
        });
      }
      grid.push(row);
    }

    res.json({ classId, days: classDays, periods: classPeriods, grid, time_slots: classTimeSlots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

app.put('/api/timetable/:classId/slot', authMiddleware, async (req, res) => {
  const { classId } = req.params;
  const { dayIndex, periodIndex, subject, department: newDept } = req.body;
  const { department, role, is_approved } = req.user;

  if (role === 'professor' && !is_approved) {
    return res.status(403).json({ error: 'Your account is pending approval. Read-only access.' });
  }

  try {
    const { rows } = await pool.query(`
      SELECT department, subject FROM timetable_slots
      WHERE class_id = $1 AND period_index = $2 AND day_index = $3
    `, [classId, periodIndex, dayIndex]);

    const slot = rows[0];
    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    if (role === 'admin' && newDept) {
      await pool.query(`
        UPDATE timetable_slots SET department = $1
        WHERE class_id = $2 AND period_index = $3 AND day_index = $4
      `, [newDept, classId, periodIndex, dayIndex]);
      return res.json({ ok: true, slot: { ...slot, department: newDept } });
    }

    if (role !== 'admin' && slot.department !== department) {
      return res.status(403).json({ error: 'Only the assigned department can edit this slot' });
    }

    await pool.query(`
      UPDATE timetable_slots SET subject = $1
      WHERE class_id = $2 AND period_index = $3 AND day_index = $4
    `, [subject, classId, periodIndex, dayIndex]);

    res.json({ ok: true, slot: { ...slot, subject } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// CSV export — no auth header needed if token in query param for download links
app.get('/api/timetable/:classId/export', authMiddleware, async (req, res) => {
  const { classId } = req.params;

  try {
    const [clsResult, slotsResult] = await Promise.all([
      pool.query('SELECT days, periods, time_slots FROM timetable_classes WHERE class_id = $1', [classId]),
      pool.query('SELECT period_index, day_index, department, subject FROM timetable_slots WHERE class_id = $1 ORDER BY period_index, day_index', [classId])
    ]);

    if (clsResult.rows.length === 0) return res.status(404).json({ error: 'Class not found' });

    const classInfo = clsResult.rows[0];
    const classDays = classInfo.days ? JSON.parse(classInfo.days) : DAYS;
    const classPeriods = classInfo.periods || PERIODS;
    const classTimeSlots = classInfo.time_slots ? JSON.parse(classInfo.time_slots) :
      Array.from({ length: classPeriods }, (_, i) => `${i + 9}:00 - ${i + 10}:00`);

    const slotMap = {};
    for (const row of slotsResult.rows) {
      slotMap[`${row.period_index}_${row.day_index}`] = row;
    }

    // Build CSV
    const headers = ['Period', 'Time', ...classDays];
    const csvRows = [headers.join(',')];

    for (let p = 0; p < classPeriods; p++) {
      const row = [`Period ${p + 1}`, `"${classTimeSlots[p] || ''}"`];
      for (let d = 0; d < classDays.length; d++) {
        const slot = slotMap[`${p}_${d}`];
        const cellText = slot ? `"${slot.department}: ${slot.subject || 'TBD'}"` : '"-"';
        row.push(cellText);
      }
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="timetable-${classId}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ============================================================
// SEARCH — cross-class subject/department search
// ============================================================
app.get('/api/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ results: [] });
  }

  try {
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    const { rows } = await pool.query(`
      SELECT 
        s.class_id,
        s.period_index,
        s.day_index,
        s.department,
        s.subject,
        tc.days,
        tc.time_slots,
        tc.periods
      FROM timetable_slots s
      JOIN timetable_classes tc ON s.class_id = tc.class_id
      WHERE 
        LOWER(s.subject) LIKE $1 
        OR LOWER(s.department) LIKE $1
      ORDER BY s.class_id, s.period_index, s.day_index
      LIMIT 50
    `, [searchTerm]);

    const results = rows.map(r => {
      const days = r.days ? JSON.parse(r.days) : DAYS;
      const timeSlots = r.time_slots ? JSON.parse(r.time_slots) : [];
      return {
        classId: r.class_id,
        periodIndex: r.period_index,
        dayIndex: r.day_index,
        day: days[r.day_index] || `Day ${r.day_index + 1}`,
        period: r.period_index + 1,
        timeSlot: timeSlots[r.period_index] || `Period ${r.period_index + 1}`,
        department: r.department,
        subject: r.subject
      };
    });

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================================
// STATS — analytics dashboard
// ============================================================
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [classStats, deptStats, totalSlots, filledSlots] = await Promise.all([
      // Per-class slot fill stats
      pool.query(`
        SELECT 
          s.class_id,
          COUNT(*) as total,
          COUNT(NULLIF(TRIM(s.subject), '')) as filled
        FROM timetable_slots s
        GROUP BY s.class_id
        ORDER BY s.class_id
      `),
      // Per-department stats across all classes
      pool.query(`
        SELECT 
          department,
          COUNT(*) as total_slots,
          COUNT(NULLIF(TRIM(subject), '')) as filled_slots
        FROM timetable_slots
        GROUP BY department
        ORDER BY total_slots DESC
      `),
      pool.query(`SELECT COUNT(*) as count FROM timetable_slots`),
      pool.query(`SELECT COUNT(*) as count FROM timetable_slots WHERE TRIM(subject) != ''`)
    ]);

    res.json({
      byClass: classStats.rows.map(r => ({
        classId: r.class_id,
        total: parseInt(r.total),
        filled: parseInt(r.filled),
        pct: r.total > 0 ? Math.round((r.filled / r.total) * 100) : 0
      })),
      byDepartment: deptStats.rows.map(r => ({
        department: r.department,
        totalSlots: parseInt(r.total_slots),
        filledSlots: parseInt(r.filled_slots)
      })),
      overall: {
        totalSlots: parseInt(totalSlots.rows[0].count),
        filledSlots: parseInt(filledSlots.rows[0].count),
        pct: totalSlots.rows[0].count > 0
          ? Math.round((filledSlots.rows[0].count / totalSlots.rows[0].count) * 100)
          : 0
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
