// ------------------------------------------------------
// Load environment variables from .env file AT THE VERY TOP
// ------------------------------------------------------
require('dotenv').config();

// ------------------------------------------------------
// Import required packages
// ------------------------------------------------------
const express = require('express');
const cors = require('cors');

// Import our database query function
const db = require('./src/db');

// Import authentication routes
const authRoutes = require('./src/routes/auth.routes');

// ------------------------------------------------------
// Create an Express application
// ------------------------------------------------------
const app = express();

// Define a port to run on (environment variable or 3000)
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------
// --- Global Middleware ---
// ------------------------------------------------------

// Allow Cross-Origin requests (so your Svelte frontend can talk to backend)
app.use(cors({
  origin: '*', // For development only — restrict in production
}));

// Parse incoming JSON request bodies
app.use(express.json());

// ------------------------------------------------------
// --- Routes ---
// ------------------------------------------------------

// Health Check Route — verifies API + Database
app.get('/api/health', async (req, res) => {
  try {
    // Run a simple query to test DB connection
    const dbResult = await db.query('SELECT NOW()');
    const dbTime = dbResult.rows[0].now;

    res.json({
      status: 'ok',
      message: 'Tohfe Hayaat API is running!',
      dbStatus: 'connected',
      dbTime: dbTime, // Database current time
    });
  } catch (err) {
    console.error('Database connection failed!', err);
    res.status(500).json({
      status: 'error',
      message: 'API is running, but database connection failed.',
      dbStatus: 'error',
      error: err.message,
    });
  }
});

// Mount authentication routes under /api/auth
app.use('/api/auth', authRoutes);

// ------------------------------------------------------
// --- Server Startup ---
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
