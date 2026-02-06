import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true })); // Update this origin after deploying frontend!
app.use(express.json());

// Root route for health check
app.get('/', (req, res) => {
  res.send('Timetable Management System API is running');
});

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = 8;

// --- Middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, department } = req.body;

  if (!email.endsWith('@nitkkr.ac.in')) {
    return res.status(400).json({ error: 'Only @nitkkr.ac.in emails are allowed' });
  }

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await pool.query(`
      INSERT INTO users (email, password_hash, role, department, name)
      VALUES ($1, $2, 'professor', $3, $4)
      RETURNING id, is_approved
    `, [email, passwordHash, department, name]);

    const newUser = result.rows[0];

    // Auto-approve if needed, but per requirements logic is admin approval
    if (newUser.is_approved) {
      // should not happen based on default but handling just in case
    }

    res.json({ success: true, message: 'Registration successful. Wait for admin approval.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      is_approved: user.is_approved ? 1 : 0, // Normalize for frontend
      name: user.name
    }, JWT_SECRET);

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
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Admin Routes ---

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, email, name, department, role, is_approved 
      FROM users 
      WHERE role = 'professor'
    `);

    // Normalize boolean
    const users = rows.map(u => ({ ...u, is_approved: u.is_approved ? 1 : 0 }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/approve', authMiddleware, adminMiddleware, async (req, res) => {
  const { userId, approve } = req.body;
  try {
    const { rowCount } = await pool.query('UPDATE users SET is_approved = $1 WHERE id = $2', [approve ? true : false, userId]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, is_approved: approve });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

app.post('/api/admin/classes', authMiddleware, adminMiddleware, async (req, res) => {
  const { classId } = req.body;
  if (!classId) return res.status(400).json({ error: 'classId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT class_id FROM timetable_classes WHERE class_id = $1', [classId]);
    if (rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Class already exists' });
    }

    await client.query('INSERT INTO timetable_classes (class_id) VALUES ($1)', [classId]);

    // Batch Insert Slots
    const initDept = 'Common';
    let values = [];
    let placeholders = [];
    let counter = 1;

    for (let p = 0; p < PERIODS; p++) {
      for (let d = 0; d < 5; d++) {
        placeholders.push(`($${counter++}, $${counter++}, $${counter++}, $${counter++}, '')`);
        values.push(classId, p, d, initDept);
      }
    }

    const query = `
      INSERT INTO timetable_slots (class_id, period_index, day_index, department, subject)
      VALUES ${placeholders.join(', ')}
    `;

    await client.query(query, values);
    await client.query('COMMIT');

    res.json({ success: true, classId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create class' });
  } finally {
    client.release();
  }
});

// --- Timetable Routes ---

app.get('/api/classes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT class_id FROM timetable_classes');
    const classes = rows.map(r => r.class_id);
    res.json({ classes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

app.get('/api/timetable/:classId', async (req, res) => {
  const { classId } = req.params;

  try {
    // Verify class exists
    const { rows: clsRows } = await pool.query('SELECT class_id FROM timetable_classes WHERE class_id = $1', [classId]);
    if (clsRows.length === 0) return res.status(404).json({ error: 'Class not found' });

    // Fetch slots
    const { rows } = await pool.query(`
      SELECT period_index, day_index, department, subject
      FROM timetable_slots
      WHERE class_id = $1
    `, [classId]);

    // Reconstruct grid
    const grid = [];
    for (let p = 0; p < PERIODS; p++) {
      const row = [];
      for (let d = 0; d < 5; d++) {
        row.push({ department: '', subject: '' });
      }
      grid.push(row);
    }

    for (const row of rows) {
      if (grid[row.period_index] && grid[row.period_index][row.day_index]) {
        grid[row.period_index][row.day_index] = {
          department: row.department,
          subject: row.subject
        };
      }
    }

    res.json({ classId, days: DAYS, periods: PERIODS, grid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

app.put('/api/timetable/:classId/slot', authMiddleware, async (req, res) => {
  const { classId } = req.params;
  const { dayIndex, periodIndex, subject, department: newDept } = req.body;
  const { department, role, is_approved } = req.user;

  // Check approval status
  if (role === 'professor' && !is_approved) {
    return res.status(403).json({ error: 'Your account is pending approval. Read-only access.' });
  }

  try {
    // Check if slot exists
    const { rows } = await pool.query(`
      SELECT department, subject
      FROM timetable_slots
      WHERE class_id = $1 AND period_index = $2 AND day_index = $3
    `, [classId, periodIndex, dayIndex]);

    const slot = rows[0];

    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    // Admin Structure Change Logic
    if (role === 'admin' && newDept) {
      await pool.query(`
        UPDATE timetable_slots 
        SET department = $1
        WHERE class_id = $2 AND period_index = $3 AND day_index = $4
      `, [newDept, classId, periodIndex, dayIndex]);
      return res.json({ ok: true, slot: { ...slot, department: newDept } });
    }

    // Professor Subject Edit Logic
    // Authorization check: Only assigned department can edit
    if (role !== 'admin' && slot.department !== department) {
      return res.status(403).json({ error: 'Only the assigned department can edit this slot' });
    }

    await pool.query(`
      UPDATE timetable_slots 
      SET subject = $1 
      WHERE class_id = $2 AND period_index = $3 AND day_index = $4
    `, [subject, classId, periodIndex, dayIndex]);

    res.json({ ok: true, slot: { ...slot, subject } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
