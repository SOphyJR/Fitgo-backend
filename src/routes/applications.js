const router = require('express').Router();
const pool = require('../config/db');
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/applications/seller
router.post('/seller', async (req, res) => {
  try {
    const {
      user_id,
      store_name,
      store_location,
      store_category,
      tin_number,
      national_id_url,
      tin_document_url,
      business_license_url,
      store_photo_url,
    } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const existing = await pool.query(
      `SELECT id FROM seller_applications WHERE user_id = $1 AND status = 'pending'`,
      [user_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A pending seller application already exists for this user' });
    }

    const result = await pool.query(
      `INSERT INTO seller_applications
        (user_id, store_name, store_location, store_category, tin_number,
         national_id_url, tin_document_url, business_license_url, store_photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user_id, store_name, store_location, store_category, tin_number,
       national_id_url, tin_document_url, business_license_url, store_photo_url]
    );

    await pool.query(
      `UPDATE users SET application_status = 'pending', status = 'pending' WHERE id = $1`,
      [user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/applications/driver
router.post('/driver', async (req, res) => {
  try {
    const {
      user_id,
      vehicle_type,
      vehicle_plate,
      national_id_url,
      driving_license_url,
      vehicle_photo_url,
      profile_photo_url,
    } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const existing = await pool.query(
      `SELECT id FROM driver_applications WHERE user_id = $1 AND status = 'pending'`,
      [user_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A pending driver application already exists for this user' });
    }

    const result = await pool.query(
      `INSERT INTO driver_applications
        (user_id, vehicle_type, vehicle_plate, national_id_url,
         driving_license_url, vehicle_photo_url, profile_photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, vehicle_type, vehicle_plate, national_id_url,
       driving_license_url, vehicle_photo_url, profile_photo_url]
    );

    await pool.query(
      `UPDATE users SET application_status = 'pending', status = 'pending' WHERE id = $1`,
      [user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/sellers (admin)
router.get('/sellers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sa.*, u.name, u.email, u.phone
       FROM seller_applications sa
       JOIN users u ON sa.user_id = u.id
       ORDER BY sa.submitted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/drivers (admin)
router.get('/drivers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT da.*, u.name, u.email, u.phone
       FROM driver_applications da
       JOIN users u ON da.user_id = u.id
       ORDER BY da.submitted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:type/:id/approve
router.patch('/:type/:id/approve', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!['seller', 'driver'].includes(type)) {
      return res.status(400).json({ error: 'type must be seller or driver' });
    }

    const table = type === 'seller' ? 'seller_applications' : 'driver_applications';

    const appResult = await pool.query(
      `UPDATE ${table} SET status = 'approved', reviewed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appResult.rows[0];

    await pool.query(
      `UPDATE users SET application_status = 'approved', status = 'approved' WHERE id = $1`,
      [application.user_id]
    );

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [application.user_id]);
    const user = userResult.rows[0];

    if (user.email) {
      try {
        await resend.emails.send({
          from: 'FitGo <onboarding@resend.dev>',
          to: user.email,
          subject: `Your FitGo ${type} application is approved!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #F5F3EE; padding: 40px; border-radius: 16px;">
              <h1 style="font-size: 32px; margin-bottom: 8px;">FitGo<span style="color: #FF3C2E;">.</span></h1>
              <p style="color: #888; margin-bottom: 32px;">Style. Delivered. Instantly.</p>
              <div style="background: rgba(255,60,46,0.1); border: 1px solid rgba(255,60,46,0.3); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 32px;">
                <p style="font-size: 48px; margin: 0 0 12px;">🎉</p>
                <h2 style="font-size: 24px; color: #FF3C2E; margin: 0 0 8px;">You're approved!</h2>
                <p style="color: #aaa; margin: 0;">Welcome to FitGo as a ${type}</p>
              </div>
              <h2 style="font-size: 20px; margin-bottom: 16px;">Hi ${user.name || 'there'} 👋</h2>
              <p style="color: #aaa;">Your ${type} application has been reviewed and approved. You can now log in and get started.</p>
              <p style="color: #555; font-size: 13px; margin-top: 24px;">— The FitGo Team 🇪🇹</p>
            </div>
          `,
        });
      } catch (_) {}
    }

    res.json({ message: `${type} application approved`, application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:type/:id/reject
router.patch('/:type/:id/reject', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { reason } = req.body;

    if (!['seller', 'driver'].includes(type)) {
      return res.status(400).json({ error: 'type must be seller or driver' });
    }
    if (!reason) return res.status(400).json({ error: 'rejection reason is required' });

    const table = type === 'seller' ? 'seller_applications' : 'driver_applications';

    const appResult = await pool.query(
      `UPDATE ${table} SET status = 'rejected', rejection_reason = $2, reviewed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, reason]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appResult.rows[0];

    await pool.query(
      `UPDATE users SET application_status = 'rejected', status = 'rejected' WHERE id = $1`,
      [application.user_id]
    );

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [application.user_id]);
    const user = userResult.rows[0];

    if (user.email) {
      try {
        await resend.emails.send({
          from: 'FitGo <onboarding@resend.dev>',
          to: user.email,
          subject: `FitGo — Your ${type} application was not approved`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #F5F3EE; padding: 40px; border-radius: 16px;">
              <h1 style="font-size: 32px; margin-bottom: 8px;">FitGo<span style="color: #FF3C2E;">.</span></h1>
              <p style="color: #888; margin-bottom: 32px;">Style. Delivered. Instantly.</p>
              <h2 style="font-size: 20px; margin-bottom: 16px;">Hi ${user.name || 'there'} 👋</h2>
              <p style="color: #aaa; margin-bottom: 24px;">Unfortunately, your ${type} application was not approved at this time.</p>
              <div style="background: #1C1C1C; border: 1px solid #333; border-radius: 14px; padding: 24px; margin-bottom: 32px;">
                <p style="color: #888; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px;">Reason</p>
                <p style="color: #F5F3EE; margin: 0;">${reason}</p>
              </div>
              <p style="color: #aaa;">If you believe this was a mistake or have questions, please contact our support team.</p>
              <p style="color: #555; font-size: 13px; margin-top: 24px;">— The FitGo Team 🇪🇹</p>
            </div>
          `,
        });
      } catch (_) {}
    }

    res.json({ message: `${type} application rejected`, application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:type/:id/review-office
router.patch('/:type/:id/review-office', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!['seller', 'driver'].includes(type)) {
      return res.status(400).json({ error: 'type must be seller or driver' });
    }

    const table = type === 'seller' ? 'seller_applications' : 'driver_applications';

    const appResult = await pool.query(
      `UPDATE ${table} SET status = 'review_office', reviewed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appResult.rows[0];

    await pool.query(
      `UPDATE users SET application_status = 'review_office', status = 'review_office' WHERE id = $1`,
      [application.user_id]
    );

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [application.user_id]);
    const user = userResult.rows[0];

    if (user.email) {
      try {
        const docList = type === 'seller'
          ? '<li>Original TIN certificate</li><li>Original business license</li>'
          : '<li>Original driving license</li><li>Original vehicle registration</li>';

        await resend.emails.send({
          from: 'FitGo <onboarding@resend.dev>',
          to: user.email,
          subject: `FitGo — Action required: Visit our office to complete your ${type} application`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #F5F3EE; padding: 40px; border-radius: 16px;">
              <h1 style="font-size: 32px; margin-bottom: 8px;">FitGo<span style="color: #FF3C2E;">.</span></h1>
              <p style="color: #888; margin-bottom: 32px;">Style. Delivered. Instantly.</p>
              <div style="background: rgba(255,60,46,0.1); border: 1px solid rgba(255,60,46,0.3); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 32px;">
                <p style="font-size: 48px; margin: 0 0 12px;">📋</p>
                <h2 style="font-size: 24px; color: #FF3C2E; margin: 0 0 8px;">Office visit required</h2>
                <p style="color: #aaa; margin: 0;">One more step to complete your application</p>
              </div>
              <h2 style="font-size: 20px; margin-bottom: 16px;">Hi ${user.name || 'there'} 👋</h2>
              <p style="color: #aaa; margin-bottom: 24px;">
                We have reviewed your ${type} application and need to verify your original documents
                in person. Please visit the FitGo office at your earliest convenience to complete
                the verification process.
              </p>
              <div style="background: #1C1C1C; border: 1px solid #333; border-radius: 14px; padding: 24px; margin-bottom: 32px;">
                <p style="color: #888; font-size: 13px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px;">Documents to bring</p>
                <ul style="color: #F5F3EE; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Original National ID</li>
                  ${docList}
                </ul>
              </div>
              <p style="color: #aaa;">Please contact our support team to schedule your visit or for directions to our office.</p>
              <p style="color: #555; font-size: 13px; margin-top: 24px;">— The FitGo Team 🇪🇹</p>
            </div>
          `,
        });
      } catch (_) {}
    }

    res.json({ message: `${type} application marked for office review`, application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
