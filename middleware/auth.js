const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies.kabu_admin_token;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { requireAuth };