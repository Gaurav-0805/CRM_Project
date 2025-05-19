const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

/**
 * ✅ GET /api/users/developers
 * → List of users with role 'Developer'
 */
router.get('/developers', authenticateJWT, authorizeRoles('Admin', 'Support'), async (req, res) => {
  try {
    const roleResult = await pool.query("SELECT id FROM roles WHERE name = 'Developer' LIMIT 1");

    if (roleResult.rows.length === 0) {
      return res.status(500).json({ error: 'Developer role not found in roles table' });
    }

    const developerRoleId = roleResult.rows[0].id;

    const result = await pool.query(`
      SELECT id, name, email, username, company_id
      FROM users
      WHERE role_id = $1
    `, [developerRoleId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching developers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * ✅ GET /api/users/contacts?company_id=...
 * → Fetch contact persons for a company (excluding Customer role)
 */
router.get('/contacts', authenticateJWT, async (req, res) => {
  const { company_id } = req.query;

  if (!company_id) {
    return res.status(400).json({ error: 'Missing company_id query param' });
  }

  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, r.name AS role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.company_id = $1 AND r.name != 'Customer'
    `, [company_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching contacts:', err.message);
    console.error(err); // full stack
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * ✅ GET /api/users/company/:companyId
 * → Fetch all users for a specific company
 */
router.get('/company/:companyId', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer'), async (req, res) => {
  const { companyId } = req.params;

  try {
    const contactsQuery = `
      SELECT u.id, u.name, u.email, u.phone, u.role_id, r.name AS role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.company_id = $1
    `;
    const result = await pool.query(contactsQuery, [companyId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching contacts by company:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * ✅ GET /api/users/:id
 * → Fetch user by ID
 * ⚠️ Must come after all specific routes to avoid conflicts (like /contacts)
 */
router.get('/:id', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer', 'Developer'), async (req, res) => {
  const { id } = req.params;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const userQuery = `
      SELECT u.id, u.name, u.email, u.username, u.role_id, r.name AS role, u.company_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `;
    const result = await pool.query(userQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user by ID:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
