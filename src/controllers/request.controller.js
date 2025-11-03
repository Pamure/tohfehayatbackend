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
    const insertRequestQuery = `
      INSERT INTO requests (
        requester_user_id, requester_name, age, blood_group, organ_needed,
        contact, city, medical_reason, budget, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
      RETURNING *;
    `;
    const requestValues = [
      requesterUserId, requester_name, age, blood_group, organ_needed,
      contact, city, medical_reason || null, budget || 0.0
    ];
    const requestResult = await db.query(insertRequestQuery, requestValues);
    res.status(201).json({
      message: 'Request created successfully.',
      status: 'pending',
      request: requestResult.rows[0]
    });
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ message: 'Server error while creating request.', error: err.message });
  }
};

exports.checkRequestMatches = async (req, res) => {
  try {
    const { organ_needed, blood_group } = req.body;
    const requesterUserId = req.user.userId;
    const findMatchQuery = `
      SELECT * FROM donations
      WHERE status = 'pending'
      AND organ = $1
      AND user_id != $2
      ORDER BY created_at ASC;
    `;
    const potentialMatches = await db.query(findMatchQuery, [organ_needed, requesterUserId]);
    const compatibleMatches = [];
    for (const donation of potentialMatches.rows) {
      if (isBloodCompatible(donation.blood_group, blood_group)) {
        compatibleMatches.push(donation);
      }
    }
    res.status(200).json({ matches: compatibleMatches });
  } catch (err) {
    console.error('Check request matches error:', err);
    res.status(500).json({ message: 'Server error while checking matches.' });
  }
};
exports.fulfillRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const donorUserId = req.user.userId;

    const {
      donor_name,
      age,
      blood_group,
      organ,
      contact,
      city,
      availability_date,
      medical_notes,
      requested_compensation_amount
    } = req.body;

    // ✅ Validate required fields
    if (!donor_name || !age || !blood_group || !organ || !contact || !city || !availability_date) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // ✅ Step 1: Lock request row and validate existence
    const reqResult = await db.query(
      'SELECT * FROM requests WHERE id = $1 AND status != $2',
      [requestId, 'matched']
    );
    if (reqResult.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found or already fulfilled.' });
    }

    const request = reqResult.rows[0];
    if (request.requester_user_id === donorUserId) {
      return res.status(403).json({ message: "You cannot fulfill your own request." });
    }

    // ✅ Step 2: Create donation entry (accepted)
    const insertDonationQuery = `
      INSERT INTO donations (
        user_id, donor_name, age, blood_group, organ, contact, city,
        availability_date, medical_notes, requested_compensation_amount,
        status, accepted_by_user_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'accepted',$11)
      RETURNING *;
    `;

    const donationValues = [
      donorUserId,
      donor_name,
      age,
      blood_group,
      organ,
      contact,
      city,
      availability_date,
      medical_notes || null,
      requested_compensation_amount || 0.0,
      request.requester_user_id
    ];

    const donationResult = await db.query(insertDonationQuery, donationValues);
    const newDonation = donationResult.rows[0];

    // ✅ Step 3: Update request to link matched donation
    await db.query(
      'UPDATE requests SET status = $1, matched_donation_id = $2 WHERE id = $3;',
      ['matched', newDonation.id, requestId]
    );

    // ✅ Success response
    return res.status(201).json({
      message: 'Request fulfilled! Donation created and linked successfully.',
      donation: newDonation
    });

  } catch (err) {
    console.error('Fulfill request error:', err);
    return res.status(500).json({
      message: 'Server error while fulfilling request.',
      error: err.message
    });
  }
};
// exports.fulfillRequest = async (req, res) => {
//   // const client = await db.getClient();
//   const client = await db.pool.connect();
//   try {
//     const requestId = req.params.id;
//     const donorUserId = req.user.userId;
//     const { donor_name, age, blood_group, organ, contact, city, availability_date, medical_notes, requested_compensation_amount } = req.body;
//     await client.query('BEGIN');
//     const reqResult = await client.query('SELECT * FROM requests WHERE id = $1 FOR UPDATE', [requestId]);
//     if (reqResult.rows.length === 0) throw new Error('Request not found or has already been fulfilled.');
//     const request = reqResult.rows[0];
//     if (request.requester_user_id === donorUserId) return res.status(403).json({ message: "You cannot fulfill your own request." });
//     const insertDonationQuery = `
//       INSERT INTO donations (
//         user_id, donor_name, age, blood_group, organ, contact, city,
//         availability_date, medical_notes, requested_compensation_amount,
//         status, accepted_by_user_id
//       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'accepted',$11)
//       RETURNING *;
//     `;
//     const donationValues = [
//       donorUserId, donor_name, age, blood_group, organ, contact, city,
//       availability_date, medical_notes || null, requested_compensation_amount || 0.0,
//       request.requester_user_id
//     ];
//     const donationResult = await client.query(insertDonationQuery, donationValues);
//     const newDonation = donationResult.rows[0];
//     await client.query(
//       `UPDATE requests SET status = 'matched', matched_donation_id = $1 WHERE id = $2;`,
//       [newDonation.id, requestId]
//     );
//     await client.query('COMMIT');
//     res.status(201).json({
//       message: 'Request fulfilled! Your donation was created and linked.',
//       donation: newDonation
//     });
//   } catch (err) {
//     await client.query('ROLLBACK');
//     console.error('Fulfill request error:', err);
//     res.status(500).json({ message: 'Server error while fulfilling request.', error: err.message });
//   } finally {
//     client.release();
//   }
// };

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

// exports.getMyRequests = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const query = `
//       SELECT
//         r.*,
//         d.donor_name,
//         d.contact as donor_contact,
//         d.city as donor_city,
//         u.full_name as donor_user_name,
//         u.email as donor_email
//       FROM requests r
//       LEFT JOIN donations d ON r.matched_donation_id = d.id
//       LEFT JOIN users u ON d.user_id = u.id
//       WHERE r.requester_user_id = $1
//       ORDER BY r.created_at DESC;
//     `;
//     const result = await db.query(query, [userId]);
//     res.status(200).json({
//       message: 'Fetched user requests successfully!',
//       requests: result.rows
//     });
//   } catch (err) {
//     console.error('Get my requests error:', err);
//     res.status(500).json({ message: 'Server error while fetching user requests.' });
//   }
// };
exports.getMyRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1️⃣ Get all requests made by this user
    const requestsQuery = `
      SELECT
        r.*,
        d.donor_name,
        d.contact AS donor_contact,
        d.city AS donor_city,
        u.full_name AS donor_user_name,
        u.email AS donor_email
      FROM requests r
      LEFT JOIN donations d ON r.matched_donation_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE r.requester_user_id = $1
    `;
    const requestsResult = await db.query(requestsQuery, [userId]);

    // 2️⃣ Get all donations accepted for this user
    const donationsQuery = `
      SELECT
        d.id,
        d.created_at,
        d.accepted_by_user_id AS requester_user_id,
        d.donor_name AS requester_name,
        d.age,
        d.blood_group,
        d.organ AS organ_needed,
        d.contact,
        d.city,
        d.medical_notes AS medical_reason,
        d.requested_compensation_amount AS budget,
        d.status,
        d.id AS matched_donation_id,
        u.full_name AS donor_user_name,
        u.email AS donor_email
      FROM donations d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.accepted_by_user_id = $1
    `;
    const donationsResult = await db.query(donationsQuery, [userId]);

    // 3️⃣ Combine and normalize both sets into one unified array
    const combined = [
      ...requestsResult.rows.map(r => ({
        ...r,
        source: 'request' // to identify in frontend
      })),
      ...donationsResult.rows.map(d => ({
        ...d,
        donor_contact: d.contact, // align naming
        donor_city: d.city,
        source: 'donation' // to identify in frontend
      }))
    ];

    // 4️⃣ Sort all by created_at (latest first)
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 5️⃣ Send response
    res.status(200).json({
      message: 'Fetched user requests successfully!',
      requests: combined
    });

  } catch (err) {
    console.error('Get my requests error:', err);
    res.status(500).json({
      message: 'Server error while fetching user requests.',
      error: err.message
    });
  }
};
