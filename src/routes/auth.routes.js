const express = require('express');
const router = express.Router();

// Import the controller function
const authController = require('../controllers/auth.controller');

// Define the registration route
// POST /api/auth/register
router.post('/register', authController.registerUser);

// We will add /login here later

module.exports = router;
