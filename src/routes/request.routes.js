// src/routes/request.routes.js
const express = require('express');
const router = express.Router();

// Import our middleware and controller
const checkAuth = require('../middleware/checkAuth');
const requestController = require('../controllers/request.controller');

// --- REQUEST ROUTES ---

// POST /api/requests
// Create a new request (protected by login)
router.post('/', checkAuth, requestController.createRequest);

// GET /api/requests
// Get all pending requests (protected by login)
router.get('/', checkAuth, requestController.getAvailableRequests);
router.get('/my-activity', checkAuth, requestController.getMyRequests);
module.exports = router;
