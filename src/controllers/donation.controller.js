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

exports.createDonation = async (req, res) => {
  let newDonation;
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized: user ID not found.' });
    const { donor_name, age, blood_group, organ, contact, city, availability_date, medical_notes, requested_compensation_amount } = req.body;
    if (!donor_name || !age || !blood_group || !organ || !contact || !city || !availability_date)
      return res.status(400).json({ message: 'Missing required fields.' });
    const insertQuery = `
      INSERT INTO donations (
        user_id, donor_name, age, blood_group, organ, contact, city,
        availability_date, medical_notes, requested_compensation_amount, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;
    const values = [userId, donor_name, age, blood_group, organ, contact, city, availability_date, medical_notes || null, requested_compensation_amount || 0.0, 'pending'];
    const result = await db.query(insertQuery, values);
    newDonation = result.rows[0];
  } catch (err) {
    console.error('Create donation error:', err);
    return res.status(500).json({ message: 'Server error while creating donation.', error: err.message });
  }

  try {
    const { organ, blood_group, id: newDonationId } = newDonation;
    const findMatchQuery = `
      SELECT * FROM requests
      WHERE status = 'pending' AND organ_needed = $1
      ORDER BY created_at ASC;
    `;
    const potentialMatches = await db.query(findMatchQuery, [organ]);
    let matchedRequest = null;
    for (const request of potentialMatches.rows) {
      if (isBloodCompatible(blood_group, request.blood_group)) {
        matchedRequest = request;
        break;
      }
    }
    if (matchedRequest) {
      await db.query(`UPDATE donations SET status = 'accepted', accepted_by_user_id = $1 WHERE id = $2;`, [matchedRequest.requester_user_id, newDonationId]);
      await db.query(`UPDATE requests SET status = 'matched', matched_donation_id = $1 WHERE id = $2;`, [newDonationId, matchedRequest.id]);
      newDonation.status = 'accepted';
      return res.status(201).json({ message: 'Donation created and an immediate match was found!', status: 'matched', donation: newDonation, matchedRequest });
    }
    res.status(201).json({ message: 'Donation created successfully. No immediate match found.', status: 'pending', donation: newDonation });
  } catch (matchErr) {
    console.error('Error during matching process:', matchErr);
    res.status(201).json({ message: 'Donation was created, but an error occurred during matching.', status: 'pending', donation: newDonation, matchError: matchErr.message });
  }
};

exports.getAvailableDonations = async (req, res) => {
  try {
    const { city, blood_group, organ } = req.query;
    let baseQuery = "SELECT * FROM donations WHERE status = 'pending'";
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
    if (organ) {
      baseQuery += ` AND organ = $${paramIndex}`;
      values.push(organ);
      paramIndex++;
    }
    baseQuery += ' ORDER BY created_at DESC';
    const result = await db.query(baseQuery, values);
    res.status(200).json({ message: 'Available donations fetched successfully!', filtersApplied: req.query, count: result.rows.length, donations: result.rows });
  } catch (err) {
    console.error('Get donations error:', err);
    res.status(500).json({ message: 'Server error while fetching donations.' });
  }
};

exports.acceptDonation = async (req, res) => {
  try {
    const donationId = req.params.id;
    const accepterUserId = req.user.userId;
    const updateQuery = `
      UPDATE donations
      SET status = 'accepted', accepted_by_user_id = $1
      WHERE id = $2 AND status = 'pending'
      RETURNING *;
    `;
    const result = await db.query(updateQuery, [accepterUserId, donationId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Donation not available or already accepted.' });
    const updateRequestQuery = `
      UPDATE requests
      SET status = 'matched', matched_donation_id = $1
      WHERE requester_user_id = $2 AND status = 'pending' AND organ_needed = $3;
    `;
    db.query(updateRequestQuery, [donationId, accepterUserId, result.rows[0].organ]);
    res.status(200).json({ message: 'Donation accepted successfully!', donation: result.rows[0] });
  } catch (err) {
    console.error('Accept donation error:', err);
    res.status(500).json({ message: 'Server error while accepting donation.' });
  }
};

exports.getMyDonations = async (req, res) => {
  try {
    const userId = req.user.userId;

    // This query finds all donations posted by the user
    // AND joins the 'users' table to get the RECIPIENT'S info if it's accepted.
    const query = `
      SELECT
        d.*,
        u.full_name as recipient_name,
        u.email as recipient_email,
        u.phone as recipient_phone,
        u.city as recipient_city
      FROM donations d
      LEFT JOIN users u ON d.accepted_by_user_id = u.id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC;
    `;

    const result = await db.query(query, [userId]);

    res.status(200).json({
      message: 'Fetched user donations successfully!',
      donations: result.rows
    });

  } catch (err) {
    console.error('Get my donations error:', err);
    res.status(500).json({
      message: 'Server error while fetching user donations.'
    });
  }
};
