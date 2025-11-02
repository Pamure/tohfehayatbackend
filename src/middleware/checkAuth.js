const jwt = require('jsonwebtoken');

// This is our "bouncer" function
module.exports = (req, res, next) => {
  try {
    // 1. Get the token from the "Authorization" header
    // It's usually in the format: "Bearer TOKEN_STRING"
    // We split it on the space and take the 2nd part.
    const token = req.headers.authorization.split(' ')[1];

    // 2. Verify the token using our JWT_SECRET
    // This checks if it's valid and not expired
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Attach the user's data to the request object
    // This makes `req.user` available in all our *next* routes
    req.user = {
      userId: decodedToken.userId,
      isAdmin: decodedToken.isAdmin
    };

    // 4. Let the request continue to its original destination
    next();

  } catch (error) {
    // This 'catch' block runs if there's no token or it's invalid
    res.status(401).json({
      message: 'Authentication failed: You must be logged in.',
    });
  }
};
