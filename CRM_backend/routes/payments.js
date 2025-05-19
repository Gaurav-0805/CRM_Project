const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');

/** ✅ Get Payments for Finance Tab (filtered by company if needed) */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { company_id, startDate, endDate } = req.query;
    let payments;

    if (userRole === 'Admin' || userRole === 'Support') {
      const conditions = [];
      const values = [];
      let idx = 1;

      if (company_id) {
        conditions.push(`i.company_id = $${idx++}`);
        values.push(company_id);
      }

      if (startDate && endDate) {
        conditions.push(`p.payment_date BETWEEN $${idx++} AND $${idx++}`);
        values.push(startDate, endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      payments = await pool.query(`
        SELECT 
          p.id AS payment_id,
          p.invoice_id,
          i.invoice_number,
          i.amount AS invoice_amount,
          c.name AS company_name,
          p.amount_paid,
          (i.amount - p.amount_paid) AS balance_due,
          p.payment_date AS paid_at,
          p.payment_method,
          s.name AS payment_status
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        JOIN companies c ON i.company_id = c.id
        JOIN status_master s ON i.status_id = s.id
        ${whereClause}
        ORDER BY p.payment_date DESC
      `, values);

    } else if (userRole === 'Customer') {
      const companyRes = await pool.query(`SELECT company_id FROM customers WHERE user_id = $1`, [userId]);

      if (companyRes.rows.length === 0) {
        return res.status(403).json({ error: 'User is not associated with any customer' });
      }

      const companyId = companyRes.rows[0].company_id;

      payments = await pool.query(`
        SELECT 
          p.id AS payment_id,
          p.invoice_id,
          i.invoice_number,
          i.amount AS invoice_amount,
          p.amount_paid,
          (i.amount - p.amount_paid) AS balance_due,
          p.payment_date AS paid_at,
          p.payment_method,
          s.name AS payment_status
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        JOIN status_master s ON i.status_id = s.id
        WHERE i.company_id = $1
        ORDER BY p.payment_date DESC
      `, [companyId]);

    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(payments.rows);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Get Payment by ID with Invoices and Transactions */
router.get('/:id', authenticateJWT, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid payment ID' });

  try {
    const paymentRes = await pool.query(`
      SELECT 
        p.id AS payment_id,
        p.amount_paid,
        p.payment_method,
        p.payment_date,
        s.name AS payment_status
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN status_master s ON i.status_id = s.id
      WHERE p.id = $1
    `, [id]);

    if (paymentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentRes.rows[0];

    const invoiceRes = await pool.query(`
      SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        i.due_date,
        i.amount,
        c.name AS company_name
      FROM invoices i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = (
        SELECT invoice_id FROM payments WHERE id = $1
      )
    `, [id]);

    const transactionsRes = await pool.query(`
      SELECT 
        transaction_id,
        transaction_date,
        amount,
        status,
        remarks,
        gateway_reference
      FROM transactions
      WHERE payment_id = $1
      ORDER BY transaction_date DESC
    `, [id]);

    payment.invoices = invoiceRes.rows;
    payment.transactions = transactionsRes.rows;

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Generate PDF for Payment Receipt */
router.get('/:id/pdf', authenticateJWT, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).send('Invalid payment ID');

  try {
    const result = await pool.query(`
      SELECT 
        p.id AS payment_id,
        c.name AS company_name,
        p.invoice_id,
        i.amount,
        p.amount_paid,
        i.due_date,
        p.payment_date
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN companies c ON i.company_id = c.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('Payment not found');
    }

    const payment = result.rows[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payment_${id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    doc.fontSize(16).text(`Payment Receipt`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Payment ID: ${payment.payment_id}`);
    doc.text(`Company Name: ${payment.company_name}`);
    doc.text(`Invoice ID: ${payment.invoice_id}`);
    doc.text(`Amount Paid: ₹${payment.amount_paid}`);
    doc.text(`Invoice Amount: ₹${payment.amount}`);
    doc.text(`Due Date: ${payment.due_date ? new Date(payment.due_date).toLocaleDateString() : 'N/A'}`);
    doc.text(`Payment Date: ${new Date(payment.payment_date).toLocaleDateString()}`);

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).send('Error generating PDF');
  }
});

module.exports = router;
