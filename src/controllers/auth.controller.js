// src/controllers/auth.controller.js
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ------------------------------------------------------
// Register Controller
// ------------------------------------------------------
exports.registerUser = async (req, res) => {
  // 1. Extract user data from the request body
  const {
    full_name,
    email,
    password,
    blood_group,
    city,
    phone,
    date_of_birth, // <-- NEW
    gender,        // <-- NEW
  } = req.body;

  // 2. Basic validation
  if (!full_name || !email || !password || !blood_group || !city || !phone) {
    return res.status(400).json({
      message: 'Missing required fields: full_name, email, password, blood_group, city, and phone are required.',
    });
  }

  try {
    // 3. Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. SQL query to insert a new user (UPDATED)
    const insertQuery = `
      INSERT INTO users (
        full_name, email, password_hash, blood_group, city, phone, date_of_birth, gender
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, full_name;
    `;

    const values = [
      full_name,
      email,
      passwordHash,
      blood_group,
      city,
      phone,
      date_of_birth, // Can be null if not provided
      gender,        // Can be null if not provided
    ];

    const result = await db.query(insertQuery, values);

    // 5. Success response
    res.status(201).json({
      message: 'User registered successfully!',
      user: result.rows[0],
    });

  } catch (err) {
    console.error('Registration error:', err);
    // Handle duplicate email (unique constraint violation)
    if (err.code === '23505') {
      return res.status(400).json({
        message: 'Error: An account with this email already exists.',
      });
    }

    res.status(500).json({
      message: 'Server error during registration.',
    });
  }
};

// ------------------------------------------------------
// Login Controller
// ------------------------------------------------------
// (This function was already correct in your file ,
// no changes were needed, but it's included here for completeness)
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find the user by email
    const findUserQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await db.query(findUserQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        message: 'Authentication failed: Invalid email or password.',
      });
    }

    // 2. Compare the provided password with the stored hash
    const user = userResult.rows[0];
    const storedPasswordHash = user.password_hash;

    const isPasswordCorrect = await bcrypt.compare(password, storedPasswordHash);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: 'Authentication failed: Invalid email or password.',
      });
    }

    // 3. Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        isAdmin: user.is_admin,
      },
      process.env.JWT_SECRET, // <-- Reads from your .env file
      { expiresIn: '1h' }
    );

    // 4. Success response with token
    res.status(200).json({
      message: 'Login successful!',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_admin: user.is_admin,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      message: 'Server error during login.',
    });
  }
};
