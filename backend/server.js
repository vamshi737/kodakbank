require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path'); // ✅ ADD THIS

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve files from ../frontend so /login.html works in browser
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err.message);
  } else {
    console.log('✅ Connected to MySQL');
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

// Signup
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, message: 'User registered successfully' });
    });
  } catch {
    res.status(500).json({ error: 'Error hashing password' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid email or password' });

    res.json({ success: true, message: 'Login successful' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
