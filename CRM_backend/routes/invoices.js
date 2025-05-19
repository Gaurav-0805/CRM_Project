const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

/** ✅ Customer: View Own Invoices */
router.get('/my-invoices', authenticateJWT, authorizeRoles('Customer'), async (req, res) => {
  try {
    const userId = req.user.id;
    const companyRes = await pool.query('SELECT company_id FROM customers WHERE user_id = $1', [userId]);

    if (companyRes.rows.length === 0) {
      return res.status(403).json({ error: 'No associated company found' });
    }

    const companyId = companyRes.rows[0].company_id;

    const result = await pool.query(`
      SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        i.amount,
        i.due_date,
        i.paid_at,
        COALESCE(u.name, 'N/A') AS salesperson_name,
        s.name AS status,
        co.name AS company_name,
        co.address,
        co.gstin
      FROM invoices i
      JOIN companies co ON i.company_id = co.id
      JOIN status_master s ON i.status_id = s.id
      LEFT JOIN users u ON i.salesperson_id = u.id
      WHERE i.company_id = $1
      ORDER BY i.due_date DESC
    `, [companyId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customer invoices:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


/** ✅ Admin/Support: Add Invoice */
router.post('/', authenticateJWT, authorizeRoles('Support', 'Admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, amount, due_date, status_id, salesperson_id, products = [] } = req.body;
    const supportId = req.user.id;
    let finalStatusId = status_id;

    await client.query('BEGIN');

    if (!finalStatusId) {
      const statusRes = await client.query("SELECT id FROM status_master WHERE LOWER(name) = 'unpaid'");
      if (statusRes.rows.length === 0) throw new Error("'Unpaid' status not found");
      finalStatusId = statusRes.rows[0].id;
    }

    const insertRes = await client.query(`
      INSERT INTO invoices (company_id, amount, due_date, status_id, salesperson_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [company_id, amount, due_date, finalStatusId, salesperson_id || null]);

    const invoiceId = insertRes.rows[0].id;
    const invoiceNumber = `INV${invoiceId.toString().padStart(3, '0')}`;

    await client.query(`UPDATE invoices SET invoice_number = $1 WHERE id = $2`, [invoiceNumber, invoiceId]);

    for (const product of products) {
      const { product_id, quantity } = product;
      await client.query(`
        INSERT INTO invoice_products (invoice_id, product_id, quantity)
        VALUES ($1, $2, $3)
      `, [invoiceId, product_id, quantity]);
    }

    await client.query(`
      INSERT INTO activity_logs (user_id, action_type, table_name, record_id, timestamp)
      VALUES ($1, 'INSERT', 'invoices', $2, NOW())
    `, [supportId, invoiceId]);

    await client.query('COMMIT');

    const fullInvoice = await pool.query(`
      SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        i.amount,
        i.due_date,
        i.paid_at,
        COALESCE(u.name, 'N/A') AS salesperson_name,
        s.name AS status,
        co.name AS company_name,
        co.address
      FROM invoices i
      JOIN companies co ON i.company_id = co.id
      JOIN status_master s ON i.status_id = s.id
      LEFT JOIN users u ON i.salesperson_id = u.id
      WHERE i.id = $1
    `, [invoiceId]);

    res.json(fullInvoice.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding invoice:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  } finally {
    client.release();
  }
});

/** ✅ Admin/Support: Get All Invoice Statuses */
router.get('/statuses', authenticateJWT, authorizeRoles('Support', 'Admin'), async (_, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name FROM status_master WHERE type = 'Invoice' ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching statuses:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Admin/Support: View All Invoices */
router.get('/', authenticateJWT, authorizeRoles('Support', 'Admin'), async (_, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        i.amount,
        i.due_date,
        i.paid_at,
        COALESCE(u.name, 'N/A') AS salesperson_name,
        s.name AS status,
        co.name AS company_name,
        co.address,
        co.gstin,
        pm.name AS product_name,
        pm.description AS product_description,
        pm.price,
        ip.quantity,
        (pm.price * ip.quantity) AS line_total
      FROM invoices i
      JOIN companies co ON i.company_id = co.id
      JOIN status_master s ON i.status_id = s.id
      LEFT JOIN users u ON i.salesperson_id = u.id
      LEFT JOIN invoice_products ip ON i.id = ip.invoice_id
      LEFT JOIN product_master pm ON ip.product_id = pm.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all invoices:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


/** ✅ All Roles: Get Invoice by ID */
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    let result;
    if (role === 'Admin' || role === 'Support') {
      result = await pool.query(`
        SELECT 
          i.id AS invoice_id,
          i.invoice_number,
          i.amount,
          i.due_date,
          i.paid_at,
          COALESCE(u.name, 'N/A') AS salesperson_name,
          s.name AS status,
          co.name AS company_name,
          co.address,
          co.gstin,
          pm.name AS product_name,
          pm.description AS product_description,
          pm.price,
          ip.quantity,
          (pm.price * ip.quantity) AS line_total
        FROM invoices i
        JOIN companies co ON i.company_id = co.id
        JOIN status_master s ON i.status_id = s.id
        LEFT JOIN users u ON i.salesperson_id = u.id
        LEFT JOIN invoice_products ip ON i.id = ip.invoice_id
        LEFT JOIN product_master pm ON ip.product_id = pm.id
        WHERE i.id = $1
      `, [id]);
    } else if (role === 'Customer') {
      const companyRes = await pool.query('SELECT company_id FROM customers WHERE user_id = $1', [userId]);
      if (companyRes.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });

      const companyId = companyRes.rows[0].company_id;
      result = await pool.query(`
        SELECT 
          i.id AS invoice_id,
          i.invoice_number,
          i.amount,
          i.due_date,
          i.paid_at,
          s.name AS status,
          co.name AS company_name,
          co.address,
          co.gstin
        FROM invoices i
        JOIN companies co ON i.company_id = co.id
        JOIN status_master s ON i.status_id = s.id
        WHERE i.id = $1 AND i.company_id = $2
      `, [id, companyId]);
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invoice by ID:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Support: Edit Invoice */
router.patch('/:id', authenticateJWT, authorizeRoles('Support'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, due_date, status_id, salesperson_id } = req.body;
    const supportId = req.user.id;

    const result = await pool.query(`
      UPDATE invoices SET 
        amount = COALESCE($1, amount),
        due_date = COALESCE($2, due_date),
        status_id = COALESCE($3, status_id),
        salesperson_id = COALESCE($4, salesperson_id),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [amount, due_date, status_id, salesperson_id, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    await pool.query(`
      INSERT INTO activity_logs (user_id, action_type, table_name, record_id, timestamp)
      VALUES ($1, 'UPDATE', 'invoices', $2, NOW())
    `, [supportId, id]);

    res.json({ message: 'Invoice updated successfully', invoice: result.rows[0] });
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Mark Invoice as Sent */
router.patch('/:id/send', authenticateJWT, authorizeRoles('Support'), async (req, res) => {
  try {
    const { id } = req.params;
    const supportId = req.user.id;

    const statusQuery = await pool.query(`SELECT id FROM status_master WHERE LOWER(name) = 'sent'`);
    if (statusQuery.rows.length === 0) throw new Error("'Sent' status not found");

    const sentStatusId = statusQuery.rows[0].id;

    const result = await pool.query(`
      UPDATE invoices SET status_id = $1, updated_at = NOW()
      WHERE id = $2 RETURNING *
    `, [sentStatusId, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    await pool.query(`
      INSERT INTO activity_logs (user_id, action_type, table_name, record_id, timestamp)
      VALUES ($1, 'STATUS_UPDATE', 'invoices', $2, NOW())
    `, [supportId, id]);

    res.json({ message: 'Invoice marked as sent', invoice: result.rows[0] });
  } catch (err) {
    console.error('Error sending invoice:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

/** ✅ Customer: Pay Invoice */
router.patch('/:id/pay', authenticateJWT, authorizeRoles('Customer'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const companyRes = await pool.query(`SELECT company_id FROM customers WHERE user_id = $1`, [userId]);
    if (companyRes.rows.length === 0) return res.status(403).json({ error: 'No associated company' });

    const companyId = companyRes.rows[0].company_id;

    const invoiceQuery = await pool.query(`
      SELECT * FROM invoices WHERE id = $1 AND company_id = $2
    `, [id, companyId]);

    if (invoiceQuery.rows.length === 0) return res.status(403).json({ error: 'Unauthorized access to this invoice' });

    const statusQuery = await pool.query(`SELECT id FROM status_master WHERE LOWER(name) = 'paid'`);
    if (statusQuery.rows.length === 0) throw new Error("'Paid' status not found");

    const paidStatusId = statusQuery.rows[0].id;

    const result = await pool.query(`
      UPDATE invoices SET 
        status_id = $1, 
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [paidStatusId, id]);

    await pool.query(`
      INSERT INTO activity_logs (user_id, action_type, table_name, record_id, timestamp)
      VALUES ($1, 'PAYMENT', 'invoices', $2, NOW())
    `, [userId, id]);

    res.json({ message: 'Invoice marked as paid', invoice: result.rows[0] });
  } catch (err) {
    console.error('Error paying invoice:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

const PDFDocument = require('pdfkit');

router.get('/:id/pdf', authenticateJWT, async (req, res) => {
  const invoiceId = parseInt(req.params.id);
  if (isNaN(invoiceId)) return res.status(400).send('Invalid invoice ID');

  try {
    const invoiceRes = await pool.query(`
      SELECT 
        i.invoice_number,
        i.due_date,
        i.amount,
        i.paid_at,
        co.name AS company_name,
        co.address,
        co.gstin,
        COALESCE(u.name, 'N/A') AS salesperson_name
      FROM invoices i
      JOIN companies co ON i.company_id = co.id
      LEFT JOIN users u ON i.salesperson_id = u.id
      WHERE i.id = $1
    `, [invoiceId]);

    if (invoiceRes.rows.length === 0) return res.status(404).send('Invoice not found');
    const invoice = invoiceRes.rows[0];

    const productsRes = await pool.query(`
      SELECT 
        pm.name AS product_name,
        pm.description,
        pm.price,
        ip.quantity,
        (pm.price * ip.quantity) AS line_total
      FROM invoice_products ip
      JOIN product_master pm ON ip.product_id = pm.id
      WHERE ip.invoice_id = $1
    `, [invoiceId]);

    const products = productsRes.rows;
    const totalSum = products.reduce((acc, p) => acc + Number(p.line_total), 0);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoice_number}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Title
    doc.font('Helvetica-Bold').fontSize(20).text('TAX INVOICE', { align: 'center' });
    doc.moveDown(1.5);

    // Invoice Info
    doc.font('Helvetica').fontSize(12);
    doc.text(`Invoice Number: ${invoice.invoice_number}`);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`);
    doc.text(`Amount: ${Number(invoice.amount).toFixed(2)}`);
    doc.text(`Paid At: ${invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'Not Paid'}`);
    doc.moveDown(1);

    // Customer Info
    doc.text(`Customer Name: ${invoice.company_name}`);
    doc.text(`Address: ${invoice.address}`);
    doc.text(`GSTIN: ${invoice.gstin}`);
    doc.text(`Salesperson: ${invoice.salesperson_name}`);
    doc.moveDown(1.5);

    // Table Setup
    const tableTop = doc.y;
    const margin = doc.page.margins.left;
    const usableWidth = doc.page.width - margin * 2;

    const colWidths = {
      product: usableWidth * 0.20,
      description: usableWidth * 0.40,
      qty: usableWidth * 0.10,
      price: usableWidth * 0.15,
      total: usableWidth * 0.15,
    };

    const rowHeight = 25;

    // Header Row
    doc.rect(margin, tableTop, usableWidth, rowHeight).fill('#eeeeee').stroke();
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(12);

    let x = margin + 5;
    doc.text('Product', x, tableTop + 7, { width: colWidths.product - 10 });
    x += colWidths.product;
    doc.text('Description', x + 5, tableTop + 7, { width: colWidths.description - 10 });
    x += colWidths.description;
    doc.text('Qty', x + 5, tableTop + 7, { width: colWidths.qty - 10, align: 'right' });
    x += colWidths.qty;
    doc.text('Price', x + 5, tableTop + 7, { width: colWidths.price - 10, align: 'right' });
    x += colWidths.price;
    doc.text('Total', x + 5, tableTop + 7, { width: colWidths.total - 10, align: 'right' });

    // Table Body
    doc.font('Helvetica').fontSize(11);
    let y = tableTop + rowHeight;

    products.forEach((product, i) => {
      if (i % 2 === 0) {
        doc.rect(margin, y, usableWidth, rowHeight).fill('#f9f9f9').stroke();
      }

      // Grid Lines
      let xLine = margin;
      for (const width of Object.values(colWidths)) {
        doc.moveTo(xLine, y).lineTo(xLine, y + rowHeight).strokeColor('#cccccc').stroke();
        xLine += width;
      }
      doc.moveTo(margin, y).lineTo(margin + usableWidth, y).strokeColor('#cccccc').stroke();
      doc.moveTo(margin, y + rowHeight).lineTo(margin + usableWidth, y + rowHeight).stroke();

      // Data
      let xText = margin + 5;
      doc.fillColor('black');
      doc.text(product.product_name, xText, y + 7, { width: colWidths.product - 10 });
      xText += colWidths.product;
      doc.text(product.description || '-', xText + 5, y + 7, { width: colWidths.description - 10 });
      xText += colWidths.description;
      doc.text(String(product.quantity), xText + 5, y + 7, { width: colWidths.qty - 10, align: 'right' });
      xText += colWidths.qty;
      doc.text(Number(product.price).toFixed(2), xText + 5, y + 7, { width: colWidths.price - 10, align: 'right' });
      xText += colWidths.price;
      doc.text(Number(product.line_total).toFixed(2), xText + 5, y + 7, { width: colWidths.total - 10, align: 'right' });

      y += rowHeight;
    });

    // Total
    y += 15;
    doc.moveTo(margin, y).lineTo(margin + usableWidth, y).strokeColor('#aaaaaa').stroke();
    y += 10;

    doc.font('Helvetica-Bold').fontSize(14).text(`Total Amount: ${totalSum.toFixed(2)}`, margin, y, {
      width: usableWidth,
      align: 'right',
    });

    doc.end();
  } catch (err) {
    console.error('❌ Error generating invoice PDF:', err.message);
    if (!res.headersSent) res.status(500).send('Internal Server Error');
  }
});

/** ✅ Admin/Support: Get invoices by company ID */
router.get('/by-company/:companyId', authenticateJWT, authorizeRoles('Admin', 'Support'), async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) return res.status(400).json({ error: 'Invalid company ID' });

    const result = await pool.query(`
      SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        i.amount,
        i.due_date,
        i.paid_at,
        COALESCE(u.name, 'N/A') AS salesperson_name,
        s.name AS status,
        co.name AS company_name,
        co.address,
        co.gstin
      FROM invoices i
      JOIN companies co ON i.company_id = co.id
      JOIN status_master s ON i.status_id = s.id
      LEFT JOIN users u ON i.salesperson_id = u.id
      WHERE i.company_id = $1
      ORDER BY i.due_date DESC
    `, [companyId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invoices by company:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
