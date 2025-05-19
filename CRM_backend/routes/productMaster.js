const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

/** ✅ GET /products – List all products */
router.get('/products', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer'), async (req, res) => {
  try {
    const query = `
      SELECT 
        id AS product_id,
        name,
        description,
        price,
        status,
        created_at
      FROM product_master
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

module.exports = router;
