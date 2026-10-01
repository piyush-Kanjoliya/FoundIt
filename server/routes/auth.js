import {Router} from 'express';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {randomUUID, randomBytes} from 'node:crypto';
import rateLimit from 'express-rate-limit';
import {db, transaction} from '../db.js';
import {config} from '../config.js';
import {hashToken} from '../middleware/auth.js';
import {sendVerificationEmail, sendPasswordResetEmail} from '../lib/mailer.js';

export const authRouter = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: {error: 'Too many authentication attempts. Please try again in 15 minutes.'},
});

const text = (min, max) => z.string().trim().min(min).max(max);

const accountSchema = z.object({
  name: text(2, 70),
  email: z
    .email()
    .transform(s => s.toLowerCase())
    .refine(
      s => /^[^@]+@(vitstudent\.ac\.in|vit\.ac\.in)$/.test(s),
      'Use your VIT student email.'
    ),
  registration: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{3}\d{4,5}$/, 'Enter a valid VIT registration number.'),
  password: z.string().min(10).max(128),
});

const USER_FIELDS = 'id, name, email, registration, verified';

/**
 * POST /api/auth/register
 */
authRouter.post('/register', authRateLimit, async (req, res, next) => {
  try {
    const input = accountSchema.parse(req.body);

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? OR registration = ?')
      .get(input.email, input.registration);

    if (existing) {
      const error = new Error('An account with these details already exists.');
      error.status = 409;
      throw error;
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(input.password, 12);
    const shouldAutoVerify = config.DEV_AUTO_VERIFY && !config.isProduction;

    db.prepare(
      'INSERT INTO users (id, name, email, registration, password, verified) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      input.name,
      input.email,
      input.registration,
      hashedPassword,
      shouldAutoVerify ? 1 : 0
    );

    if (!shouldAutoVerify) {
      const rawToken = randomBytes(32).toString('hex');
      const hashed = hashToken(rawToken);
      const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      db.prepare(
        'INSERT INTO verification (token, user_id, expires) VALUES (?, ?, ?)'
      ).run(hashed, id, expires);

      try {
        await sendVerificationEmail(input.email, rawToken);
      } catch (err) {
        transaction(() => {
          db.prepare('DELETE FROM verification WHERE user_id = ?').run(id);
          db.prepare('DELETE FROM users WHERE id = ?').run(id);
        });
        throw err;
      }
    }

    res.status(201).json({
      message: shouldAutoVerify
        ? 'Account created and automatically verified in development mode.'
        : 'Account created. Check your email to verify it. In local development, the link is logged to the console.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify
 */
authRouter.post('/verify', (req, res, next) => {
  try {
    const {token} = z
      .object({token: z.string().regex(/^[a-f0-9]{64}$/)})
      .parse(req.body);

    const hashed = hashToken(token);
    const row = db
      .prepare('SELECT * FROM verification WHERE token = ? AND expires > ?')
      .get(hashed, Date.now());

    if (!row) {
      const error = new Error('Verification link is invalid or expired.');
      error.status = 400;
      throw error;
    }

    transaction(() => {
      db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(row.user_id);
      db.prepare('DELETE FROM verification WHERE user_id = ?').run(row.user_id);
    });

    res.json({message: 'Email verified. You can now sign in.'});
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/resend-verification (G-10)
 */
authRouter.post('/resend-verification', authRateLimit, async (req, res, next) => {
  try {
    const {email} = z
      .object({
        email: z.email().transform(s => s.toLowerCase()),
      })
      .parse(req.body);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Silent return to avoid account enumeration
    if (user && !user.verified) {
      const rawToken = randomBytes(32).toString('hex');
      const hashed = hashToken(rawToken);
      const expires = Date.now() + 24 * 60 * 60 * 1000;

      transaction(() => {
        db.prepare('DELETE FROM verification WHERE user_id = ?').run(user.id);
        db.prepare(
          'INSERT INTO verification (token, user_id, expires) VALUES (?, ?, ?)'
        ).run(hashed, user.id, expires);
      });

      await sendVerificationEmail(user.email, rawToken);
    }

    res.json({
      message:
        'If an unverified account exists with that email, a new verification link has been sent.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password (G-10)
 */
authRouter.post('/forgot-password', authRateLimit, async (req, res, next) => {
  try {
    const {email} = z
      .object({
        email: z.email().transform(s => s.toLowerCase()),
      })
      .parse(req.body);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const hashed = hashToken(rawToken);
      const expires = Date.now() + 60 * 60 * 1000; // 1 hour

      transaction(() => {
        db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
        db.prepare(
          'INSERT INTO password_resets (token, user_id, expires, used) VALUES (?, ?, ?, 0)'
        ).run(hashed, user.id, expires);
      });

      await sendPasswordResetEmail(user.email, rawToken);
    }

    // Never enumerate account existence
    res.json({
      message:
        'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password (G-10)
 */
authRouter.post('/reset-password', authRateLimit, async (req, res, next) => {
  try {
    const {token, password} = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: z.string().min(10).max(128),
      })
      .parse(req.body);

    const hashed = hashToken(token);
    const reset = db
      .prepare(
        'SELECT * FROM password_resets WHERE token = ? AND expires > ? AND used = 0'
      )
      .get(hashed, Date.now());

    if (!reset) {
      const error = new Error('Password reset link is invalid or has expired.');
      error.status = 400;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    transaction(() => {
      // Update password and mark user verified if they weren't
      db.prepare(
        'UPDATE users SET password = ?, verified = 1 WHERE id = ?'
      ).run(hashedPassword, reset.user_id);

      // Invalidate the reset token
      db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').run(
        hashed
      );

      // Clear all existing sessions for security
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
    });

    res.json({
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', authRateLimit, async (req, res, next) => {
  try {
    const {email, password} = z
      .object({
        email: z.email().transform(s => s.toLowerCase()),
        password: text(1, 128),
      })
      .parse(req.body);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      const error = new Error('Email or password is incorrect.');
      error.status = 401;
      throw error;
    }

    if (!user.verified) {
      const error = new Error('Verify your email before signing in.');
      error.status = 403;
      throw error;
    }

    const rawSessionToken = randomBytes(32).toString('hex');
    const hashedSession = hashToken(rawSessionToken);
    const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare(
      'INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)'
    ).run(hashedSession, user.id, expires);

    res.cookie('reunite_session', rawSessionToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    const userData = db
      .prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`)
      .get(user.id);
    if (userData) {
      userData.is_admin = config.adminEmails.includes(
        userData.email.toLowerCase()
      );
    }

    res.json({user: userData});
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (req, res) => {
  const token = req.cookies?.reunite_session;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(token));
  }
  res.clearCookie('reunite_session', {path: '/'}).json({ok: true});
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', (req, res) => {
  res.json({user: req.user || null});
});
