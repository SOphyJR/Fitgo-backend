const router = require('express').Router();
const pool = require('../config/db');
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

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
// POST /api/auth/approve-seller
router.post('/approve-seller', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Update user status to approved in PostgreSQL
    const result = await pool.query(
      `UPDATE users SET status = 'approved' WHERE email = $1 RETURNING *`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Send approval email
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '🎉 You are approved to sell on FitGo!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #F5F3EE; padding: 40px; border-radius: 16px;">
          <h1 style="font-size: 32px; margin-bottom: 8px;">FitGo<span style="color: #FF3C2E;">.</span></h1>
          <p style="color: #888; margin-bottom: 32px;">Style. Delivered. Instantly.</p>
          
          <div style="background: rgba(255,60,46,0.1); border: 1px solid rgba(255,60,46,0.3); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <p style="font-size: 48px; margin: 0 0 12px;">🎉</p>
            <h2 style="font-size: 24px; color: #FF3C2E; margin: 0 0 8px;">You're approved!</h2>
            <p style="color: #aaa; margin: 0;">Welcome to the FitGo seller community</p>
          </div>

          <h2 style="font-size: 20px; margin-bottom: 16px;">Hi ${user.name} 👋</h2>
          <p style="color: #aaa; margin-bottom: 24px;">
            Great news! Your store application has been reviewed and <strong style="color: #fff;">approved</strong>. 
            You can now log in to FitGo and start listing your products.
          </p>

          <div style="background: #1C1C1C; border-radius: 14px; padding: 24px; margin-bottom: 32px;">
            <p style="color: #888; font-size: 13px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;">What's next</p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <p style="margin: 0; color: #fff;">✅ Log in to your FitGo account</p>
              <p style="margin: 0; color: #fff;">📦 Add your first products</p>
              <p style="margin: 0; color: #fff;">🚀 Start receiving orders</p>
              <p style="margin: 0; color: #fff;">💰 Earn money with every delivery</p>
            </div>
          </div>

          <p style="color: #555; font-size: 13px;">Questions? Reply to this email or contact us at support@fitgo.com</p>
          <p style="color: #555; font-size: 13px; margin-top: 24px;">— The FitGo Team, Addis Ababa 🇪🇹</p>
        </div>
      `,
    };

await resend.emails.send({
  from: 'FitGo <onboarding@resend.dev>',
  to: email,
  subject: '🎉 You are approved to sell on FitGo!',
  html: `... keep same html ...`,
});

    res.json({ 
      message: 'Seller approved and notified', 
      user: result.rows[0] 
    });
  } catch (err) {
    console.error('Approve seller error:', err);
    res.status(500).json({ error: 'Failed to approve seller' });
  }
});

module.exports = router;