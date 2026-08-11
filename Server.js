/**
 * server.js
 * KABU DIGITALS backend — Express API + admin dashboard host.
 *
 * Responsibilities:
 *  - Public POST /api/leads for the website's contact form
 *  - Admin-only endpoints (behind JWT cookie auth) to manage leads
 *  - Serves the static admin dashboard at /admin
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./Auth');
const leadsRoutes = require('./Leads');
const { ensureAdmin } = require('./db');

// Create the first admin login automatically if none exists yet
// (safe no-op once an admin_users row already exists).
ensureAdmin();

// Fail fast if required secrets are missing — a missing JWT_SECRET
// would otherwise silently sign tokens with "undefined".
if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in environment. Copy .env.example to .env and set one.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// The public site (e.g. hosted on GitHub Pages) calls this API from a
// different origin, so its exact origin must be allow-listed here.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
  .split(',')
  .map((origin) => origin.trim());

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/non-browser requests (no Origin header) and
    // any explicitly allow-listed origin.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'kabu-digitals-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);

app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Static admin dashboard (plain HTML/CSS/JS — no build step).
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'Index.HTML'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Centralized error handler — keeps stack traces out of API responses.
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`KABU DIGITALS backend running on http://localhost:${PORT}`);
  console.log(`Admin dashboard:        http://localhost:${PORT}/admin`);
});