const router = require('express').Router();
const pool = require('../config/db');
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTPEmail = async (email, otp, name) => {
  await resend.emails.send({
    from: 'FitGo <onboarding@resend.dev>',
    to: email,
    subject: 'FitGo — Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #F5F3EE; padding: 40px; border-radius: 16px;">
        <h1 style="font-size: 32px; margin-bottom: 8px;">FitGo<span style="color: #FF3C2E;">.</span></h1>
        <p style="color: #888; margin-bottom: 32px;">Style. Delivered. Instantly.</p>
        <h2 style="font-size: 20px; margin-bottom: 16px;">Hi ${name} 👋</h2>
        <p style="color: #aaa; margin-bottom: 32px;">Use the code below to verify your FitGo account. This code expires in <strong style="color: #fff;">10 minutes</strong>.</p>
        <div style="background: #1C1C1C; border: 1px solid #333; border-radius: 14px; padding: 32px; text-align: center; margin-bottom: 32px;">
          <p style="color: #888; font-size: 13px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px;">Your verification code</p>
          <h1 style="font-size: 48px; letter-spacing: 12px; color: #FF3C2E; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #555; font-size: 13px;">If you didn't request this, ignore this email.</p>
        <p style="color: #555; font-size: 13px; margin-top: 24px;">— The FitGo Team, Addis Ababa 🇪🇹</p>
      </div>
    `,
  });
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM otp_codes WHERE email = $1', [email]);
    await pool.query(
      'INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, otp, expiresAt]
    );

    await sendOTPEmail(email, otp, name || 'there');
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const result = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE email = $1 AND code = $2 AND verified = false AND expires_at > NOW()`,
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    await pool.query(
      'UPDATE otp_codes SET verified = true WHERE id = $1',
      [result.rows[0].id]
    );

    await pool.query(
      `UPDATE users SET status = 'active' WHERE email = $1`,
      [email]
    );

    res.json({ message: 'Email verified successfully', verified: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, name } = req.body;

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM otp_codes WHERE email = $1', [email]);
    await pool.query(
      'INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, otp, expiresAt]
    );

    await sendOTPEmail(email, otp, name || 'there');
    res.json({ message: 'OTP resent successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// POST /api/auth/approve-user (handles both sellers and drivers)
router.post('/approve-user', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await pool.query(
      `UPDATE users SET status = 'approved' WHERE email = $1 RETURNING *`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    await resend.emails.send({
      from: 'FitGo <onboarding@resend.dev>',
      to: email,
      subject: `🎉 You are approved as a FitGo ${user.role}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #F5F3EE; padding: 40px; border-radius: 16px;">
          <h1 style="font-size: 32px; margin-bottom: 8px;">FitGo<span style="color: #FF3C2E;">.</span></h1>
          <div style="background: rgba(255,60,46,0.1); border: 1px solid rgba(255,60,46,0.3); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <p style="font-size: 48px; margin: 0 0 12px;">🎉</p>
            <h2 style="font-size: 24px; color: #FF3C2E; margin: 0 0 8px;">You're approved!</h2>
            <p style="color: #aaa; margin: 0;">Welcome to FitGo as a ${user.role}</p>
          </div>
          <h2 style="font-size: 20px; margin-bottom: 16px;">Hi ${user.name} 👋</h2>
          <p style="color: #aaa;">Your application has been approved. Log in to get started.</p>
          <p style="color: #555; font-size: 13px; margin-top: 24px;">— The FitGo Team 🇪🇹</p>
        </div>
      `,
    });

    res.json({ message: `${user.role} approved and notified`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Default OTPs per role
const DEFAULT_OTPS = {
  customer: '009988',
  seller: '112233',
  driver: '221133',
};

// POST /api/auth/send-phone-otp
router.post('/send-phone-otp', async (req, res) => {
  try {
    const { phone, role } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    res.json({ message: 'OTP sent', hint: 'Use default OTP for your role' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-phone-otp
router.post('/verify-phone-otp', async (req, res) => {
  try {
    const { phone, code, role } = req.body;
    if (!phone || !code || !role) {
      return res.status(400).json({ error: 'Phone, code and role are required' });
    }

  const expectedOTP = DEFAULT_OTPS[role];
    if (code !== expectedOTP) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // Check if user exists with this phone
    const result = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length > 0) {
      // Existing user — return their data
      res.json({ verified: true, user: result.rows[0], isNew: false });
    } else {
      // New user
      res.json({ verified: true, user: null, isNew: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;