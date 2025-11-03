// Import the 'Pool' class from the 'pg' package
const { Pool } = require('pg');

// We need to load our environment variables *before* we create the pool
require('dotenv').config();

// // Create a new Pool instance
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   // THIS BLOCK IS CRITICAL FOR SUPABASE
//   ssl: {
//     rejectUnauthorized: false
//   },
//   // --- THIS IS THE NEW LINE ---
//   // Limit the number of connections in our pool
//   max: 5,
// });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000, // 10s
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PG Pool Error:', err);
});
// We'll export a simple 'query' function that logs the query and uses the pool
module.exports = {
  query: (text, params) => {
    console.log('EXECUTING QUERY:', text);
    return pool.query(text, params);
  },
  pool,
};
