const express = require('express');
const router = express.Router();

// Import our new middleware
const checkAuth = require('../middleware/checkAuth');

// This route is "protected"
// GET /api/test/protected
router.get('/protected', checkAuth, (req, res) => {
  // Because 'checkAuth' ran, we now have 'req.user'
  res.status(200).json({
    message: 'Success! You accessed a protected route.',
    userData: req.user
  });
});

module.exports = router;
