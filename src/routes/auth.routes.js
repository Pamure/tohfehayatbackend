const express = require('express');
const router = express.Router();

// Import the controller functions
const authController = require('../controllers/auth.controller');

// ----------------------------
// AUTH ROUTES
// ----------------------------

// 🧾 Register route — to create a new user
// POST /api/auth/register
router.post('/register', authController.registerUser);

// 🔐 Login route — to authenticate user and issue JWT
// POST /api/auth/login
router.post('/login', authController.loginUser);

// ----------------------------
// Export router
// ----------------------------
module.exports = router;
