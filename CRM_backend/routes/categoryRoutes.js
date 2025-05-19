const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

// ✅ GET /api/categories – Fetch all task categories
router.get('/', authenticateJWT, authorizeRoles('Admin', 'Support'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id AS category_id, name 
      FROM tasks_master 
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
