const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,


});

module.exports = pool;
