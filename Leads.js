/**
 * routes/leads.js
 * - POST /api/leads        public — the website's contact form posts here
 * - GET  /api/leads        admin  — list + filter + search
 * - GET  /api/leads/stats  admin  — counts for the dashboard header
 * - GET  /api/leads/:id    admin  — single lead detail
 * - PATCH /api/leads/:id   admin  — update status
 * - DELETE /api/leads/:id  admin  — remove a lead
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { requireAuth } = require('./middleware/auth');
const { sendNewLeadNotification } = require('./mailer');

const router = express.Router();

const VALID_STATUSES = ['new', 'contacted', 'in_progress', 'completed', 'archived'];
const VALID_SERVICES = ['Graphic Design', 'Website Development', 'AI & Automation', 'Digital Solution', 'Other'];

// Prevent the public submit endpoint from being spammed/abused.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later or reach us on WhatsApp.' },
});

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
}

/* ---------------------------------------------------------
   PUBLIC — submit a new project request
--------------------------------------------------------- */
router.post('/', submitLimiter, async (req, res) => {
  const { name, company, email, phone, service, budget, details, website } = req.body || {};

  // Honeypot field — a real visitor never fills this hidden field in,
  // so a filled value means it's very likely a bot. Pretend success.
  if (website) {
    return res.status(201).json({ ok: true });
  }

  if (!name || !email || !service || !budget || !details) {
    return res.status(400).json({ error: 'Name, email, service, budget and project details are required.' });
  }

  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (!VALID_SERVICES.includes(service)) {
    return res.status(400).json({ error: 'Please select a valid service.' });
  }

  if (String(details).length > 5000) {
    return res.status(400).json({ error: 'Project details are too long (max 5000 characters).' });
  }

  const stmt = db.prepare(`
    INSERT INTO leads (name, company, email, phone, service, budget, details)
    VALUES (@name, @company, @email, @phone, @service, @budget, @details)
  `);

  const result = stmt.run({
    name: String(name).trim().slice(0, 200),
    company: company ? String(company).trim().slice(0, 200) : null,
    email: String(email).trim().slice(0, 200),
    phone: phone ? String(phone).trim().slice(0, 60) : null,
    service,
    budget: String(budget).trim().slice(0, 60),
    details: String(details).trim(),
  });

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);

  // Fire-and-forget — a slow/broken mail server should never block
  // the visitor's confirmation response.
  sendNewLeadNotification(lead);

  res.status(201).json({ ok: true, id: lead.id });
});

/* ---------------------------------------------------------
   ADMIN — everything below requires a valid session
--------------------------------------------------------- */
router.use(requireAuth);

router.get('/stats', (req, res) => {
  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM leads GROUP BY status
  `).all();

  const total = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const last7Days = db.prepare(`
    SELECT COUNT(*) as count FROM leads WHERE created_at >= datetime('now', '-7 days')
  `).get().count;

  const byStatus = Object.fromEntries(VALID_STATUSES.map((s) => [s, 0]));
  counts.forEach((row) => { byStatus[row.status] = row.count; });

  res.json({ total, last7Days, byStatus });
});

router.get('/', (req, res) => {
  const { status, service, search, page = 1, pageSize = 20 } = req.query;

  const conditions = [];
  const params = {};

  if (status && VALID_STATUSES.includes(status)) {
    conditions.push('status = @status');
    params.status = status;
  }

  if (service && VALID_SERVICES.includes(service)) {
    conditions.push('service = @service');
    params.service = service;
  }

  if (search) {
    conditions.push('(name LIKE @search OR company LIKE @search OR email LIKE @search OR details LIKE @search)');
    params.search = `%${search}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const rows = db.prepare(`
    SELECT * FROM leads ${whereClause}
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  const total = db.prepare(`SELECT COUNT(*) as count FROM leads ${whereClause}`).get(params).count;

  res.json({ leads: rows, total, page: Number(page) || 1, pageSize: limit });
});

router.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  res.json(lead);
});

router.patch('/:id', (req, res) => {
  const { status } = req.body || {};

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  db.prepare(`UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, req.params.id);

  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;