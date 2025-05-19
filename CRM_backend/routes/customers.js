const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

// ✅ GET /api/companies/customers → Customer List
router.get('/customers', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer'), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query;
    let values = [];

    if (userRole === 'Customer') {
      query = `
        SELECT 
  co.id AS company_id,
  co.name AS company_name,
  co.address,
  co.created_at,
  sm.name AS project_status,
  u.name AS contact_person,
  u.email AS email
FROM companies co
LEFT JOIN status_master sm ON co.status_id = sm.id
LEFT JOIN users u ON co.contact_user_id = u.id::text
JOIN customers cu ON cu.company_id = co.id
WHERE cu.user_id = $1 AND sm.type = 'Customer Lifecycle'
ORDER BY co.created_at DESC;

      `;
      values = [userId];
    } else {
      query = `
       SELECT 
  co.id AS company_id,
  co.name AS company_name,
  co.address,
  co.created_at,
  sm.name AS project_status,
  u.name AS contact_person,
  u.email AS email
FROM companies co
LEFT JOIN status_master sm ON co.status_id = sm.id
LEFT JOIN users u ON co.contact_user_id = u.id::text
JOIN customers cu ON cu.company_id = co.id
WHERE sm.type = 'Customer Lifecycle'
ORDER BY co.created_at DESC;

      `;
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customer data:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET /api/companies/customers/:id → Detailed Customer View
router.get('/customers/:id', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer'), async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: "Invalid company ID" });
    }

    const { role, company_id: userCompanyId } = req.user;

    const params = [companyId];
    let additionalCondition = '';
    if (role === 'Customer') {
      additionalCondition = 'AND co.id = $1 AND co.id = $2';
      params.push(userCompanyId);
    } else {
      additionalCondition = 'AND co.id = $1';
    }

    const query = `
      SELECT 
  co.id AS company_id,
  co.name AS company_name,
  co.address,
  co.phone,
  co.gstin,
  co.credit_limit,
  co.type,
  co.created_at,
  sm.name AS project_status,
  u.name AS contact_person,
  u.email AS email
FROM companies co
LEFT JOIN status_master sm ON co.status_id = sm.id
LEFT JOIN users u ON co.contact_user_id = u.id::text
JOIN customers cu ON cu.company_id = co.id
WHERE sm.type = 'Customer Lifecycle'

      ${additionalCondition}
    `;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching customer by ID:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET /api/companies/customers/:companyId/subscriptions → Subscriptions
router.get('/customers/:companyId/subscriptions', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer'), async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    const { role, company_id: userCompanyId } = req.user;

    if (role === 'Customer' && userCompanyId !== companyId) {
      return res.status(403).json({ error: 'Access denied for this company' });
    }

    const result = await pool.query(`
      SELECT 
        ps.id AS subscription_id,
        pm.name AS product_name,
        ps.start_date,
        ps.end_date,
        ps.status
      FROM product_subscriptions ps
      JOIN product_master pm ON ps.product_id = pm.id
      WHERE ps.company_id = $1
      ORDER BY ps.start_date DESC
    `, [companyId]);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
