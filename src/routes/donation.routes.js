const express = require('express');
const router = express.Router();

// Import our middleware and controller
const checkAuth = require('../middleware/checkAuth');
const donationController = require('../controllers/donation.controller');

// POST /api/donations
// This route is protected by checkAuth
router.post('/', checkAuth, donationController.createDonation);

// GET /api/donations
router.get('/', checkAuth, donationController.getAvailableDonations);
// We'll add routes to GET donations here later
router.get('/my-activity', checkAuth, donationController.getMyDonations);
router.put('/:id/accept', checkAuth, donationController.acceptDonation);
module.exports = router;
