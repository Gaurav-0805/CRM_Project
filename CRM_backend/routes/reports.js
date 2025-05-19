const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

// 📊 1. New Business Report – Only companies with 'Onboarding' status and date range filter
router.get('/new-business', authenticateJWT, authorizeRoles('Admin'), async (req, res) => {
  try {
    const { start, end } = req.query;
    console.log('📥 New Business Request:', { start, end });

    let query = `
      SELECT c.id AS customer_id, c.name, c.email, c.created_at, co.name AS company_name
      FROM customers c
      JOIN companies co ON c.company_id = co.id
      JOIN status_master sm ON co.status_id = sm.id
      WHERE sm.name = 'Onboarding'
    `;
    
    const params = [];

    if (start && end) {
      query += ` AND c.created_at BETWEEN $1::timestamp AND $2::timestamp`;
      params.push(start, end);
    } else {
      query += ` AND c.created_at >= NOW() - INTERVAL '30 days'`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ New Business Report Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📅 2. Payment Due Report
router.get('/payment-due', authenticateJWT, authorizeRoles('Admin'), async (req, res) => {
  const { start, end } = req.query;
  console.log('🔍 Received Query Params:', req.query);

  try {
    let query = `
      SELECT 
        i.id AS invoice_id,
        co.name AS company_name,
        i.invoice_number,
        i.amount,
        COALESCE(p.amount_paid, 0) AS amount_paid,
        (i.amount - COALESCE(p.amount_paid, 0)) AS balance_due,
        i.due_date,
        s.name AS status
      FROM invoices i
      JOIN companies co ON i.company_id = co.id
      JOIN status_master s ON i.status_id = s.id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount_paid) AS amount_paid
        FROM payments
        GROUP BY invoice_id
      ) p ON i.id = p.invoice_id
      WHERE s.name IN ('Unpaid', 'Partially Paid', 'Overdue')
    `;

    const params = [];

    if (start && end) {
      query += ` AND i.due_date BETWEEN $1::date AND $2::date`;
      params.push(start.split('T')[0], end.split('T')[0]);
    }

    query += ` ORDER BY i.due_date ASC`;

    const result = await pool.query(query, params);
    console.log('✅ Returned:', result.rows.length, 'rows');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Payment Due Report Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🧾 3. Invoice Due Report – Exact date filter required
router.get('/invoice-due', authenticateJWT, authorizeRoles('Admin'), async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Start and end dates are required' });
  }

  try {
    const query = `
      SELECT 
        i.id AS invoice_id,
        co.name AS company_name,
        i.invoice_number,
        i.amount,
        i.due_date,
        s.name AS status
      FROM invoices i
      JOIN companies co ON i.company_id = co.id
      JOIN status_master s ON i.status_id = s.id
      WHERE s.name = 'Unpaid'
        AND i.due_date BETWEEN $1::date AND $2::date
      ORDER BY i.due_date ASC
    `;
    const result = await pool.query(query, [start, end]);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Invoice Due Report Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📚 4. Ledger Report – Total invoice vs payments by company
router.get('/ledger', authenticateJWT, authorizeRoles('Admin'), async (req, res) => {
  try {
    const query = `
      SELECT 
        co.id,
        co.name AS company_name,
        COALESCE(SUM(i.amount), 0) AS total_invoiced,
        COALESCE(SUM(p.amount_paid), 0) AS total_paid,
        (COALESCE(SUM(i.amount), 0) - COALESCE(SUM(p.amount_paid), 0)) AS balance_due
      FROM companies co
      LEFT JOIN invoices i ON co.id = i.company_id
      LEFT JOIN payments p ON i.id = p.invoice_id
      GROUP BY co.id, co.name
      ORDER BY co.name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Ledger Report Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
