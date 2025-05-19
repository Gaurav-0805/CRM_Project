const jwt = require('jsonwebtoken');
const pool = require('../db'); // PostgreSQL connection

/**
 * ✅ Middleware to authenticate JWT and optionally hydrate company_id
 */
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // ✅ Ensure req.user.id is available
    if (!req.user.id) {
      return res.status(403).json({ error: 'Invalid token: missing user ID' });
    }

    // ✅ Only hydrate company_id from DB if missing AND required
    if (!req.user.company_id && req.user.role === 'Customer') {
      const result = await pool.query(
        'SELECT company_id FROM customers WHERE user_id = $1',
        [req.user.id]
      );
      if (result.rows.length > 0) {
        req.user.company_id = result.rows[0].company_id;
      }
    }

    next();
  } catch (err) {
    console.error('❌ JWT Error:', err);
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
};

/**
 * ✅ Middleware to authorize based on allowed roles
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Forbidden: Missing role in token' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  authenticateJWT,
  authorizeRoles
};
