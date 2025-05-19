const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const router = express.Router();

/**
 * 🔐 POST /login – Auth with plain password (NO hashing used here)
 */
router.post('/login', async (req, res) => {
  const { username, password, company_key } = req.body;

  try {
    // ✅ Step 1: Get user with username and company key
    const userQuery = `
      SELECT u.id, u.username, u.name, u.email, u.password, u.role_id,
             r.name AS role, c.name AS company_name, c.id AS company_id, c.company_key
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN companies c ON u.company_id = c.id
      WHERE u.username = $1 AND c.company_key = $2
    `;
    const result = await db.query(userQuery, [username, company_key]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // ✅ Step 2: Check plain password match (no hashing)
    if (password !== user.password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // ✅ Step 3: Build token payload
    const tokenPayload = {
      id: user.id,                  // Required for developer access
      role: user.role,             // 'Admin', 'Support', 'Customer', 'Developer'
      role_id: user.role_id,
      username: user.username
    };

    // Only include company_id for roles that need it (e.g. Customer, Support)
    if (['Customer', 'Support', 'Admin'].includes(user.role)) {
      tokenPayload.company_id = user.company_id;
      tokenPayload.company_key = user.company_key;
    }

    // ✅ Step 4: Sign the token
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '100h'
    });

    // ✅ Step 5: Respond with token and user data
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        role_id: user.role_id,
        company_id: user.company_id,
        company_name: user.company_name
      },
      company_key: user.company_key
    });
  } catch (error) {
    console.error('❌ Login Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
