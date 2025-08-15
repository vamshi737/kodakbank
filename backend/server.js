require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();

/* -------------------------------- Core middleware -------------------------------- */
app.use(cors()); // ok for localhost dev; tighten later for prod
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------------------------- MySQL pool + startup retry --------------------------- */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kodakbank',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Use a pool for resilience under Docker and to avoid single-connection issues
const db = mysql.createPool(dbConfig);

function testDbConnection(attempt = 1) {
  db.getConnection((err, conn) => {
    if (err) {
      console.error(`❌ MySQL connect attempt ${attempt} failed:`, err.code || err.message);
      if (attempt < 30) setTimeout(() => testDbConnection(attempt + 1), 1000);
      return;
    }
    console.log('✅ Connected to MySQL');
    conn.release();
  });
}

testDbConnection();

/* ---------------------------------- JWT helpers ---------------------------------- */
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TOKEN_NAME = 'kb_token';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[TOKEN_NAME];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/* ---------------------------------- Healthcheck ---------------------------------- */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

/* ------------------------------------- Auth -------------------------------------- */
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (email, password_hash) VALUES (?, ?)';
    db.query(sql, [email, hash], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
        console.error('Signup DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, message: 'User registered successfully' });
    });
  } catch (e) {
    console.error('Hashing error:', e);
    res.status(500).json({ error: 'Error hashing password' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

  const sql = 'SELECT id, email, password_hash FROM users WHERE email = ?';
  db.query(sql, [email], async (err, rows) => {
    if (err) {
      console.error('Login DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid email or password' });

    const token = signToken({ id: user.id, email: user.email });
    res.cookie(TOKEN_NAME, token, {
      httpOnly: true,
      sameSite: 'lax', // set 'strict' in prod if possible
      secure: false,   // true behind HTTPS
      maxAge: 2 * 60 * 60 * 1000, // 2h
    });
    res.json({ success: true, message: 'Login successful' });
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie(TOKEN_NAME, { httpOnly: true, sameSite: 'lax', secure: false });
  res.json({ success: true });
});

/* ------------------------ Protect dashboard BEFORE static ------------------------ */
app.get('/dashboard.html', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

/* ------------------------- Serve static (login/signup/etc) ------------------------ */
app.use(express.static(path.join(__dirname, '..', 'frontend')));

/* ------------------------------ REAL dashboard APIs ------------------------------ */
app.get('/api/balance', requireAuth, (req, res) => {
  const userId = req.user.id;
  db.query('SELECT balance FROM accounts WHERE user_id = ? LIMIT 1', [userId], (err, rows) => {
    if (err) {
      console.error('Balance DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    const balance = rows && rows.length ? Number(rows[0].balance) : 0;
    res.json({ balance });
  });
});

app.get('/api/transactions', requireAuth, (req, res) => {
  const userId = req.user.id;
  db.query(
    `SELECT t_date AS date, description, amount
       FROM transactions
      WHERE user_id = ?
      ORDER BY t_date DESC, id DESC
      LIMIT 20`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Transactions DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ transactions: rows || [] });
    }
  );
});

/* ------------------------------------ Root --------------------------------------- */
app.get('/', (_req, res) => res.redirect('/login.html'));

/* ------------------------------------ Start -------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
