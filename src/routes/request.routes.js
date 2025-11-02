// src/routes/request.routes.js
const express = require('express');
const router = express.Router();

// Import our middleware and controller
const checkAuth = require('../middleware/checkAuth');
const requestController = require('../controllers/request.controller');

// --- Import the new functions ---
const {
  createRequest,
  getAvailableRequests,
  getMyRequests,
  checkRequestMatches, // <-- IMPORT THIS
  fulfillRequest       // <-- IMPORT THIS
} = require('../controllers/request.controller');

// --- REQUEST ROUTES ---

// POST /api/requests
// Create a new request (protected by login)
// (This now points to the "dumb" createRequest)
router.post('/', checkAuth, createRequest);

// GET /api/requests
// Get all pending requests (protected by login)
router.get('/', checkAuth, getAvailableRequests);

// GET /api/requests/my-activity
router.get('/my-activity', checkAuth, getMyRequests);

// --- ADD THESE NEW ROUTES ---

// POST /api/requests/check-matches
// Checks for existing donations *before* creating a new request
router.post('/check-matches', checkAuth, checkRequestMatches);

// POST /api/requests/:id/fulfill
// A donor "fulfills" a specific request, creating their donation and linking it
router.post('/:id/fulfill', checkAuth, fulfillRequest);
// ----------------------------

module.exports = router;
