const express = require('express');
const pool = require('../db');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ✅ Setup upload directory
const uploadDir = path.join(__dirname, '../uploads/brd');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

/** ✅ Assigned BRDs for Developer */
router.get('/assigned', authenticateJWT, authorizeRoles('Developer'), async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.warn('❌ Missing user or user.id in token:', req.user);
      return res.status(400).json({ error: 'Invalid token: missing user ID' });
    }

    const developerId = req.user.id;
    console.log('🔍 Fetching BRDs assigned to developer ID:', developerId);

    const query = `
      SELECT b.*, s.name AS status_name, c.name AS company_name, p.name AS product_name
      FROM brds b
      LEFT JOIN status_master s ON b.status_id = s.id
      LEFT JOIN companies c ON b.company_id = c.id
      LEFT JOIN product_master p ON b.product_id = p.id
      WHERE b.assigned_to = $1
      ORDER BY b.created_at DESC`;

    const result = await pool.query(query, [developerId]);

    if (result.rows.length === 0) {
      console.warn('⚠️ No BRDs assigned to developer ID:', developerId);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching assigned BRDs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
/** ✅ Upload PDF and return URL (for embedding in Quill) */
router.post('/:id/attachments', authenticateJWT, upload.single('file'), async (req, res) => {
  try {
    const brdId = parseInt(req.params.id);
    if (isNaN(brdId)) return res.status(400).json({ error: 'Invalid BRD ID' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Save attachment info to DB
    await pool.query(
      'INSERT INTO brd_attachments (brd_id, file_name, file_path) VALUES ($1, $2, $3)',
      [brdId, req.file.originalname, `uploads/brd/${req.file.filename}`]
    );

    // Return public link
    const fileUrl = `${process.env.BASE_URL}/uploads/brd/${req.file.filename}`;
    res.status(201).json({ url: fileUrl });
  } catch (err) {
    console.error('❌ PDF upload error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Create BRD (Customer only) */
router.post('/', authenticateJWT, authorizeRoles('Customer'), upload.array('files'), async (req, res) => {
  try {
    const userId = req.user.id;
    const companyRes = await pool.query('SELECT company_id FROM customers WHERE user_id = $1', [userId]);
    if (!companyRes.rowCount) return res.status(403).json({ error: 'No associated company' });

    const company_id = companyRes.rows[0].company_id;
    const { title, description, product_id } = req.body;

    const statusRes = await pool.query(`SELECT id FROM status_master WHERE LOWER(name) = 'pending' LIMIT 1`);
    const status_id = statusRes.rows[0]?.id;

    const insertBRD = `
      INSERT INTO brds (title, description, company_id, product_id, status_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`;
    const result = await pool.query(insertBRD, [title, description, company_id, product_id, status_id]);
    const brdId = result.rows[0].id;

    console.log('📂 Uploaded files:', req.files); // ✅ Debug uploaded files

    if (req.files?.length) {
      for (const file of req.files) {
        await pool.query(
          `INSERT INTO brd_attachments (brd_id, file_name, file_path) VALUES ($1, $2, $3)`,
          [brdId, file.originalname, `uploads/brd/${file.filename}`]
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error creating BRD:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Get BRDs for logged-in customer */
router.get('/my-brds', authenticateJWT, authorizeRoles('Customer'), async (req, res) => {
  try {
    const userId = req.user.id;
    const companyRes = await pool.query('SELECT company_id FROM customers WHERE user_id = $1', [userId]);
    if (!companyRes.rowCount) return res.status(403).json({ error: 'No associated company' });

    const companyId = companyRes.rows[0].company_id;

    const query = `
      SELECT b.*, s.name AS status_name, c.name AS company_name, p.name AS product_name
      FROM brds b
      LEFT JOIN status_master s ON b.status_id = s.id
      LEFT JOIN companies c ON b.company_id = c.id
      LEFT JOIN product_master p ON b.product_id = p.id
      WHERE b.company_id = $1
      ORDER BY b.created_at DESC`;

    const result = await pool.query(query, [companyId]);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching BRDs for customer:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Get BRD by ID with attachments */
router.get('/:id', authenticateJWT, authorizeRoles('Customer', 'Support', 'Developer', 'Admin'), async (req, res) => {
  try {
    const brdId = parseInt(req.params.id);
    if (isNaN(brdId)) return res.status(400).json({ error: 'Invalid BRD ID' });

    const { id: userId, role, company_id: userCompany } = req.user;

    const brdRes = await pool.query(`
      SELECT b.*, 
             s.name AS status_name,
             c.name AS company_name,
             p.name AS product_name,
             u.name AS assigned_to_name
      FROM brds b
      LEFT JOIN status_master s ON b.status_id = s.id
      LEFT JOIN companies c ON b.company_id = c.id
      LEFT JOIN product_master p ON b.product_id = p.id
      LEFT JOIN users u ON b.assigned_to = u.id
      WHERE b.id = $1`, [brdId]);

    if (!brdRes.rowCount) return res.status(404).json({ message: 'BRD not found' });

    const brd = brdRes.rows[0];

    if (role === 'Developer' && brd.assigned_to !== userId) return res.status(403).json({ message: 'Access denied' });
    if (role === 'Customer' && brd.company_id !== userCompany) return res.status(403).json({ message: 'Access denied' });

    const attachments = await pool.query(`SELECT file_name, file_path FROM brd_attachments WHERE brd_id = $1`, [brdId]);
    brd.attachments = attachments.rows.map(f => ({
      name: f.file_name,
      url: `${process.env.BASE_URL}/${f.file_path.replace(/\\/g, '/')}` // ✅ Use env-based URL
    }));

    res.json(brd);
  } catch (err) {
    console.error('❌ Error fetching BRD by ID:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Support/Admin: View all BRDs */
router.get('/', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer'), async (req, res) => {
  try {
    const { role, company_id } = req.user;

    let query = `
      SELECT b.*, s.name AS status_name, c.name AS company_name, p.name AS product_name
      FROM brds b
      LEFT JOIN status_master s ON b.status_id = s.id
      LEFT JOIN companies c ON b.company_id = c.id
      LEFT JOIN product_master p ON b.product_id = p.id`;
    const values = [];

    if (role === 'Customer') {
      query += ` WHERE b.company_id = $1`;
      values.push(company_id);
    }

    query += ` ORDER BY b.created_at DESC`;
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching BRDs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



/** ✅ Support: Assign BRD to Developer */
router.patch('/:id/assign', authenticateJWT, authorizeRoles('Support'), async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;

    const devCheck = await pool.query(`SELECT id FROM users WHERE id = $1 AND role_id = 4`, [assigned_to]);
    if (!devCheck.rowCount) return res.status(400).json({ error: 'Invalid Developer ID' });

    const brd = await pool.query(`SELECT assigned_to, status_id FROM brds WHERE id = $1`, [id]);
    if (!brd.rowCount) return res.status(404).json({ error: 'BRD not found' });

    const { assigned_to: alreadyAssigned, status_id } = brd.rows[0];
    const approvedStatus = await pool.query(`SELECT id FROM status_master WHERE LOWER(name) = 'approved'`);
    if (status_id !== approvedStatus.rows[0]?.id) return res.status(400).json({ error: 'Only approved BRDs can be assigned' });
    if (alreadyAssigned) return res.status(400).json({ error: 'BRD already assigned' });

    const update = await pool.query(
      `UPDATE brds SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [assigned_to, id]
    );
    res.json({ message: 'BRD assigned', brd: update.rows[0] });
  } catch (err) {
    console.error('❌ Assign error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** 🔧 Get attachments for a BRD */
router.get('/:id/attachments', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer', 'Developer'), async (req, res) => {
  try {
    const brdId = parseInt(req.params.id);
    if (isNaN(brdId)) return res.status(400).json({ error: 'Invalid BRD ID' });

    const result = await pool.query(
      'SELECT file_name, file_path FROM brd_attachments WHERE brd_id = $1',
      [brdId]
    );

    const attachments = result.rows.map(file => ({
      name: file.file_name,
      url: `${process.env.BASE_URL}/${file.file_path.replace(/\\/g, '/')}` // ✅ Use env
    }));

    res.json(attachments);
  } catch (err) {
    console.error('❌ Error fetching attachments:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** 🔧 ✅ Get tasks for a BRD */
router.get('/:id/tasks', authenticateJWT, authorizeRoles('Admin', 'Support', 'Customer', 'Developer'), async (req, res) => {
  try {
    const brdId = parseInt(req.params.id);
    if (isNaN(brdId)) return res.status(400).json({ error: 'Invalid BRD ID' });

    const result = await pool.query(
      `SELECT t.*, u.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.brd_id = $1
       ORDER BY t.created_at DESC`,
      [brdId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching tasks:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** ✅ Update BRD by ID */
router.patch('/:id', authenticateJWT, authorizeRoles('Admin', 'Support'), async (req, res) => {
  try {
    const brdId = parseInt(req.params.id);
    if (isNaN(brdId)) return res.status(400).json({ error: 'Invalid BRD ID' });

    const { title, description, status_name } = req.body;

    const statusResult = await pool.query(
      `SELECT id FROM status_master WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [status_name]
    );
    const status_id = statusResult.rows[0]?.id;
    if (!status_id) return res.status(400).json({ error: 'Invalid status value' });

    const result = await pool.query(
      `UPDATE brds
       SET title = $1, description = $2, status_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title, description, status_id, brdId]
    );

    if (!result.rowCount) return res.status(404).json({ error: 'BRD not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error updating BRD:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;
