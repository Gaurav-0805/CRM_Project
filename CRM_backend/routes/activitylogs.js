const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../middlewares/auth');

// ✅ Utility function to log activity
async function logActivity(userId, tableName, recordId, actionType, actionText = null) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, table_name, record_id, action_type, action_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tableName, recordId, actionType, actionText]
    );
  } catch (error) {
    console.error("❌ Error logging activity:", error);
  }
}

// ✅ Optional: Used during login, if needed
async function logUserLogin(userId) {
  await logActivity(userId, 'users', userId, 'LOGIN');
}

// ✅ GET /logs/visits?company_id=3 — fetch visit notes for a company
router.get('/logs/visits', authenticateJWT, async (req, res) => {
  const companyId = parseInt(req.query.company_id);
  if (isNaN(companyId)) {
    return res.status(400).json({ error: 'Invalid company ID' });
  }

  try {
    const result = await pool.query(`
      SELECT al.id, u.name AS user_name, al.action_text, al.timestamp
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.table_name = 'companies'
        AND al.record_id = $1
        AND al.action_type = 'VISIT'
      ORDER BY al.timestamp DESC
    `, [companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching visit logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ POST /logs/visits — add a new visit note
router.post('/logs/visits', authenticateJWT, async (req, res) => {
  const { company_id, note } = req.body;
  const userId = req.user.id;

  if (!company_id || !note) {
    return res.status(400).json({ error: 'Company ID and note are required' });
  }

  try {
    await pool.query(`
      INSERT INTO activity_logs (user_id, table_name, record_id, action_type, action_text)
      VALUES ($1, 'companies', $2, 'VISIT', $3)
    `, [userId, company_id, note]);

    res.status(201).json({ message: 'Visit note logged successfully' });
  } catch (error) {
    console.error('❌ Error adding visit note:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
module.exports.logActivity = logActivity;
module.exports.logUserLogin = logUserLogin;
