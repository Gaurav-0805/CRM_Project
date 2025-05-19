const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

// 📦 Setup multer for screenshots
const storage = multer.diskStorage({
  destination: './uploads/screenshots/',
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueName}-${file.originalname}`);
  }
});
const upload = multer({ storage });

router.get('/assigned', authenticateJWT, authorizeRoles('Developer'), async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      console.warn('❌ JWT decoded but user or user.id is missing:', user);
      return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
    }

    console.log('✅ Developer fetching assigned tickets. User ID:', user.id);

    const result = await pool.query(`
      SELECT 
        t.id, t.ticket_name, t.ticket_description, t.created_at, t.updated_at, t.resolved_at,
        c.name AS customer_name, co.name AS company_name,
        p.name AS product_name, sm.name AS status,
        tm.name AS category, u.name AS assigned_to_name
      FROM tickets t
      LEFT JOIN customers c ON t.company_id = c.company_id
      LEFT JOIN companies co ON t.company_id = co.id
      LEFT JOIN product_master p ON t.product_id = p.id
      LEFT JOIN status_master sm ON t.status_id = sm.id
      LEFT JOIN tasks_master tm ON t.category_id = tm.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.assigned_to = $1
      ORDER BY t.created_at DESC
    `, [user.id]);

    console.log('📦 Tickets returned:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Failed to load assigned tickets:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET all tickets
router.get('/', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer', 'Developer'), async (req, res) => {
  try {
    const { id: userId, role: userRole } = req.user;
    let query = '';
    let values = [];

    if (userRole === 'Customer') {
      query = `
        SELECT 
          t.id, t.ticket_name, t.ticket_description, t.created_at, t.updated_at, t.resolved_at,
          c.name AS customer_name, co.name AS company_name,
          p.name AS product_name, sm.name AS status,
          tm.name AS category, u.name AS assigned_to_name
        FROM tickets t
        JOIN customers c ON c.user_id = $1
        JOIN companies co ON c.company_id = co.id
        LEFT JOIN product_master p ON t.product_id = p.id
        LEFT JOIN status_master sm ON t.status_id = sm.id
        LEFT JOIN tasks_master tm ON t.category_id = tm.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.company_id = co.id
        ORDER BY t.created_at DESC`;
      values = [userId];
    } else if (userRole === 'Developer') {
      query = `
        SELECT 
          t.id, t.ticket_name, t.ticket_description, t.created_at, t.updated_at, t.resolved_at,
          c.name AS customer_name, co.name AS company_name,
          p.name AS product_name, sm.name AS status,
          tm.name AS category, u.name AS assigned_to_name
        FROM tickets t
        LEFT JOIN customers c ON t.company_id = c.company_id
        LEFT JOIN companies co ON t.company_id = co.id
        LEFT JOIN product_master p ON t.product_id = p.id
        LEFT JOIN status_master sm ON t.status_id = sm.id
        LEFT JOIN tasks_master tm ON t.category_id = tm.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.assigned_to = $1
        ORDER BY t.created_at DESC`;
      values = [userId];
    } else {
      query = `
        SELECT 
          t.id, t.ticket_name, t.ticket_description, t.created_at, t.updated_at, t.resolved_at,
          c.name AS customer_name, co.name AS company_name,
          p.name AS product_name, sm.name AS status,
          tm.name AS category, u.name AS assigned_to_name
        FROM tickets t
        LEFT JOIN customers c ON t.company_id = c.company_id
        LEFT JOIN companies co ON t.company_id = co.id
        LEFT JOIN product_master p ON t.product_id = p.id
        LEFT JOIN status_master sm ON t.status_id = sm.id
        LEFT JOIN tasks_master tm ON t.category_id = tm.id
        LEFT JOIN users u ON t.assigned_to = u.id
        ORDER BY t.created_at DESC`;
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET ticket status
router.get('/status', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name FROM status_master WHERE type = 'Ticket'`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching statuses:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ CREATE ticket (with screenshots)
router.post('/', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer'), upload.array('screenshots'), async (req, res) => {
  try {
    const {
      ticket_name,
      ticket_description,
      product_id,
      status_id,
      category_id,
      company_id: bodyCompanyId,
      assigned_to
    } = req.body;

    const { id: userId, role } = req.user;

    let company_id;
    if (role === 'Customer') {
      const companyResult = await pool.query(`SELECT company_id FROM customers WHERE user_id = $1`, [userId]);
      if (companyResult.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });
      company_id = companyResult.rows[0].company_id;
    } else {
      company_id = parseInt(bodyCompanyId); // ✅ Fix: parse company ID
    }

    // ✅ Parse all number fields
    const parsedProductId = parseInt(product_id);
    const parsedStatusId = parseInt(status_id);
    const parsedCategoryId = parseInt(category_id);
    const parsedAssignedTo = assigned_to ? parseInt(assigned_to) : null;
    
    if (isNaN(parsedProductId) || isNaN(parsedStatusId) || isNaN(parsedCategoryId)) {
      return res.status(400).json({ error: 'Invalid input: product_id, status_id, or category_id is not a valid number' });
    }
    

    const result = await pool.query(`
      INSERT INTO tickets (ticket_name, ticket_description, product_id, status_id, category_id, company_id, assigned_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [ticket_name, ticket_description, parsedProductId, parsedStatusId, parsedCategoryId, company_id, parsedAssignedTo]
    );

    const ticketId = result.rows[0].id;

    if (req.files && req.files.length > 0) {
      const insertScreenshots = req.files.map(file =>
        pool.query(
          `INSERT INTO ticket_screenshots (ticket_id, name, url)
           VALUES ($1, $2, $3)`,
          [ticketId, file.originalname, `/uploads/screenshots/${file.filename}`]
        )
      );
      await Promise.all(insertScreenshots);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error creating ticket:', err.message, err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// ✅ Upload screenshot to existing ticket
router.post('/:id/screenshots', authenticateJWT, authorizeRoles('Customer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    const result = await pool.query(`
      INSERT INTO ticket_screenshots (ticket_id, name, url)
      VALUES ($1, $2, $3)
      RETURNING *`, [id, name, url]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error uploading screenshot:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET ticket by ID + screenshots
router.get('/:id', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer', 'Developer'), async (req, res) => {
  try {
    const { id } = req.params;

    const ticketResult = await pool.query(`
      SELECT t.*, c.name AS customer_name, co.name AS company_name,
             p.name AS product_name, sm.name AS status,
             tm.name AS category, u.name AS assigned_to_name
      FROM tickets t
      LEFT JOIN customers c ON t.company_id = c.company_id
      LEFT JOIN companies co ON t.company_id = co.id
      LEFT JOIN product_master p ON t.product_id = p.id
      LEFT JOIN status_master sm ON t.status_id = sm.id
      LEFT JOIN tasks_master tm ON t.category_id = tm.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1`, [id]);

    const screenshotResult = await pool.query(`
      SELECT name, url, uploaded_at
      FROM ticket_screenshots
      WHERE ticket_id = $1
      ORDER BY uploaded_at ASC`, [id]);

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];
    ticket.screenshots = screenshotResult.rows;

    res.json(ticket);
  } catch (err) {
    console.error('Error fetching ticket by ID:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ UPDATE ticket
router.put('/:id', authenticateJWT, authorizeRoles('Admin', 'Support'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status_id, category_id, assigned_to } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (status_id) updates.push(`status_id = $${idx++}`), values.push(status_id);
    if (category_id) updates.push(`category_id = $${idx++}`), values.push(category_id);
    if (assigned_to) updates.push(`assigned_to = $${idx++}`), values.push(assigned_to);

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating ticket:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Mark ticket as resolved
router.patch('/:id/resolve', authenticateJWT, authorizeRoles('Admin', 'Support', 'Developer'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      UPDATE tickets
      SET status_id = (SELECT id FROM status_master WHERE name = 'Resolved'),
          resolved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *`, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    res.json({ message: 'Ticket marked as resolved', ticket: result.rows[0] });
  } catch (err) {
    console.error('Error resolving ticket:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Escalate ticket
router.put('/:id/escalate', authenticateJWT, authorizeRoles('Support', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { developerId } = req.body;

    if (!developerId) return res.status(400).json({ error: 'Developer ID is required' });

    const result = await pool.query(`
      UPDATE tickets
      SET assigned_to = $1,
          status_id = (SELECT id FROM status_master WHERE name = 'Open'),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *`, [developerId, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    res.json({ message: 'Ticket escalated successfully', ticket: result.rows[0] });
  } catch (err) {
    console.error('Error escalating ticket:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Get tickets by company
router.get('/by-company/:companyId', authenticateJWT, async (req, res) => {
  const { companyId } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        t.id,
        t.ticket_name, -- ✅ fixed here
        sm.name AS status,
        t.created_at,
        u.name AS assigned_to_name
      FROM tickets t
      LEFT JOIN status_master sm ON t.status_id = sm.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.company_id = $1
      ORDER BY t.created_at DESC`, [companyId]);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching tickets by company:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET categories from tasks_master
router.get('/categories', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name
      FROM tasks_master
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// 🔧 Upload single image for Quill rich text editor
router.post('/upload-image', authenticateJWT, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imageUrl = `/uploads/screenshots/${req.file.filename}`;
  res.status(200).json({ url: imageUrl });
});




module.exports = router;
