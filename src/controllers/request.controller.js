const db = require('../db');

const isBloodCompatible = (donor, recipient) => {
  if (donor === 'O-') return true;
  if (donor === 'A-') return ['A-', 'A+', 'AB-', 'AB+'].includes(recipient);
  if (donor === 'A+') return ['A+', 'AB+'].includes(recipient);
  if (donor === 'B-') return ['B-', 'B+', 'AB-', 'AB+'].includes(recipient);
  if (donor === 'B+') return ['B+', 'AB+'].includes(recipient);
  if (donor === 'AB-') return ['AB-', 'AB+'].includes(recipient);
  if (donor === 'AB+') return recipient === 'AB+';
  if (donor === 'O+') return ['O+', 'A+', 'B+', 'AB+'].includes(recipient);
  return donor === recipient;
};

exports.createRequest = async (req, res) => {
  try {
    const requesterUserId = req.user?.userId;
    if (!requesterUserId) return res.status(401).json({ message: 'Unauthorized: user ID not found.' });
    const { requester_name, age, blood_group, organ_needed, contact, city, medical_reason, budget } = req.body;
    if (!requester_name || !age || !blood_group || !organ_needed || !contact || !city)
      return res.status(400).json({ message: 'Missing required fields.' });
    const findMatchQuery = `
      SELECT * FROM donations
      WHERE status = 'pending' AND organ = $1
      ORDER BY created_at ASC;
    `;
    const potentialMatches = await db.query(findMatchQuery, [organ_needed]);
    let matchedDonation = null;
    for (const donation of potentialMatches.rows) {
      if (isBloodCompatible(donation.blood_group, blood_group)) {
        matchedDonation = donation;
        break;
      }
    }
    if (matchedDonation) {
      const insertRequestQuery = `
        INSERT INTO requests (
          requester_user_id, requester_name, age, blood_group, organ_needed,
          contact, city, medical_reason, budget, status, matched_donation_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *;
      `;
      const requestValues = [
        requesterUserId, requester_name, age, blood_group, organ_needed,
        contact, city, medical_reason || null, budget || 0.0, 'matched', matchedDonation.id
      ];
      const requestResult = await db.query(insertRequestQuery, requestValues);
      await db.query(`UPDATE donations SET status = 'accepted', accepted_by_user_id = $1 WHERE id = $2;`, [requesterUserId, matchedDonation.id]);
      return res.status(201).json({
        message: 'Request created and a match was found!',
        status: 'matched',
        request: requestResult.rows[0],
        matchedDonation
      });
    }
    const insertRequestQuery = `
      INSERT INTO requests (
        requester_user_id, requester_name, age, blood_group, organ_needed,
        contact, city, medical_reason, budget, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;
    const requestValues = [
      requesterUserId, requester_name, age, blood_group, organ_needed,
      contact, city, medical_reason || null, budget || 0.0, 'pending'
    ];
    const requestResult = await db.query(insertRequestQuery, requestValues);
    res.status(201).json({
      message: 'Request created successfully. No immediate match found.',
      status: 'pending',
      request: requestResult.rows[0]
    });
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ message: 'Server error while creating request.', error: err.message });
  }
};

exports.getAvailableRequests = async (req, res) => {
  try {
    const { city, blood_group, organ_needed } = req.query;
    let baseQuery = "SELECT * FROM requests WHERE status = 'pending'";
    const values = [];
    let paramIndex = 1;
    if (city) {
      baseQuery += ` AND city ILIKE $${paramIndex}`;
      values.push(`%${city}%`);
      paramIndex++;
    }
    if (blood_group) {
      baseQuery += ` AND blood_group = $${paramIndex}`;
      values.push(blood_group);
      paramIndex++;
    }
    if (organ_needed) {
      baseQuery += ` AND organ_needed = $${paramIndex}`;
      values.push(organ_needed);
      paramIndex++;
    }
    baseQuery += ' ORDER BY created_at DESC';
    const result = await db.query(baseQuery, values);
    res.status(200).json({
      message: 'Available requests fetched successfully!',
      filtersApplied: req.query,
      count: result.rows.length,
      requests: result.rows
    });
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ message: 'Server error while fetching requests.' });
  }
};

// src/controllers/request.controller.js

// ... (isBloodCompatible, createRequest, getAvailableRequests) ...

// --- ADD THIS NEW FUNCTION ---
exports.getMyRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    // This query finds all requests by the user
    // AND joins 'donations' AND 'users' tables
    // to get the DONOR'S info if it's matched.
    const query = `
      SELECT
        r.*,
        d.donor_name,
        d.contact as donor_contact,
        d.city as donor_city,
        u.full_name as donor_user_name,
        u.email as donor_email
      FROM requests r
      LEFT JOIN donations d ON r.matched_donation_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE r.requester_user_id = $1
      ORDER BY r.created_at DESC;
    `;

    const result = await db.query(query, [userId]);

    res.status(200).json({
      message: 'Fetched user requests successfully!',
      requests: result.rows
    });

  } catch (err) {
    console.error('Get my requests error:', err);
    res.status(500).json({
      message: 'Server error while fetching user requests.'
    });
  }
};
