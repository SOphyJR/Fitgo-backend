const router = require('express').Router();
const pool = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, name) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
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
  };
  await transporter.sendMail(mailOptions);
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTPs for this email
    await pool.query('DELETE FROM otp_codes WHERE email = $1', [email]);

    // Save OTP to database
    await pool.query(
      'INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, otp, expiresAt]
    );

    // Send email
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

    // Find OTP
    const result = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE email = $1 AND code = $2 AND verified = false AND expires_at > NOW()`,
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Mark as verified
    await pool.query(
      'UPDATE otp_codes SET verified = true WHERE id = $1',
      [result.rows[0].id]
    );

    // Update user status to active
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

module.exports = router;