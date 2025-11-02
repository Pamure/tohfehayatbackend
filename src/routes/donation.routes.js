// src/routes/donation.routes.js
const express = require('express');
const router = express.Router();

// Import our middleware and controller
const checkAuth = require('../middleware/checkAuth');

// --- Import the new functions ---
const {
  createDonation,
  getAvailableDonations,
  getMyDonations,
  acceptDonation,
  checkDonationMatches // <-- IMPORT THIS
} = require('../controllers/donation.controller');


// POST /api/donations
// (This now points to the "dumb" createDonation)
router.post('/', checkAuth, createDonation);

// GET /api/donations
router.get('/', checkAuth, getAvailableDonations);

// GET /api/donations/my-activity
router.get('/my-activity', checkAuth, getMyDonations);

// PUT /api/donations/:id/accept
// (This now points to the updated acceptDonation with the self-match fix)
router.put('/:id/accept', checkAuth, acceptDonation);

// --- ADD THIS NEW ROUTE ---

// POST /api/donations/check-matches
// Checks for existing requests *before* creating a new donation
router.post('/check-matches', checkAuth, checkDonationMatches);
// --------------------------

module.exports = router;
