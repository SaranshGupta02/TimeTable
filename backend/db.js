import pkg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv'; // Ensure dotenv is loaded if this file is imported first

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
pool.connect()
  .then(() => console.log('Connected to Neon PostgreSQL'))
  .catch(err => console.error('Connection error', err.stack));

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'professor')),
        department VARCHAR(50),
        name VARCHAR(100),
        is_approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Classes Table - Create if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS timetable_classes (
        class_id VARCHAR(50) PRIMARY KEY,
        days TEXT,
        periods INTEGER DEFAULT 8,
        time_slots TEXT
      );
    `);

    // Migration attempt for existing tables missing new columns
    try {
      await client.query('ALTER TABLE timetable_classes ADD COLUMN IF NOT EXISTS days TEXT');
      await client.query('ALTER TABLE timetable_classes ADD COLUMN IF NOT EXISTS periods INTEGER DEFAULT 8');
      await client.query('ALTER TABLE timetable_classes ADD COLUMN IF NOT EXISTS time_slots TEXT');
    } catch (e) {
      console.log('Migration columns likely exist or error ignored:', e.message);
    }

    // Slots Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS timetable_slots (
        class_id VARCHAR(50) NOT NULL,
        period_index INTEGER NOT NULL,
        day_index INTEGER NOT NULL,
        department VARCHAR(50) NOT NULL,
        subject TEXT DEFAULT '',
        PRIMARY KEY (class_id, period_index, day_index),
        FOREIGN KEY (class_id) REFERENCES timetable_classes(class_id)
      );
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');

    // Seed Admin
    const { rows: adminRows } = await client.query('SELECT id FROM users WHERE email = $1', ['admin@nitkkr.ac.in']);
    if (adminRows.length === 0) {
      const hash = bcrypt.hashSync('Admin@123', 10);
      await client.query(`
        INSERT INTO users (email, password_hash, role, department, name, is_approved)
        VALUES ($1, $2, 'admin', NULL, 'Admin', TRUE)
      `, ['admin@nitkkr.ac.in', hash]);
      console.log('Admin user created: admin@nitkkr.ac.in');
    }

    // Seed Default Classes
    const { rows: classCount } = await client.query('SELECT COUNT(*) as c FROM timetable_classes');
    if (parseInt(classCount[0].c) === 0) {
      const slots = [
        [['CSE', 'MATH', 'ECE', 'CSE', 'MECH']],
        [['ECE', 'CSE', 'MATH', 'PHYSICS', 'CSE']],
        [['MATH', 'ECE', 'CSE', 'MATH', 'ECE']],
        [['CSE', 'PHYSICS', 'MECH', 'ECE', 'MATH']],
        [['PHYSICS', 'CSE', 'PHYSICS', 'CSE', 'PHYSICS']],
        [['MECH', 'MECH', 'CSE', 'MATH', 'CSE']],
        [['CSE', 'ECE', 'ECE', 'CSE', 'MECH']],
        [['MATH', 'CSE', 'MATH', 'MECH', 'ECE']],
      ];

      for (const cid of ['E101', 'E102', 'E103']) {
        await client.query('INSERT INTO timetable_classes (class_id) VALUES ($1)', [cid]);
        for (let p = 0; p < 8; p++) {
          for (let d = 0; d < 5; d++) {
            await client.query(`
              INSERT INTO timetable_slots (class_id, period_index, day_index, department, subject)
              VALUES ($1, $2, $3, $4, '')
            `, [cid, p, d, slots[p][0][d]]);
          }
        }
      }
      console.log('Default classes seeded');
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize DB', e);
  } finally {
    client.release();
  }
}

// Initialize on start
initDb();

export { initDb };
export default pool;