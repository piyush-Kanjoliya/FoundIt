import {createHash} from 'node:crypto'
import rateLimit from 'express-rate-limit'
import {db} from '../db.js'
import {config} from '../config.js'

export const hashToken = token => createHash('sha256').update(token).digest('hex')

const USER_FIELDS = 'id, name, email, registration, verified'

export function attachUser(req, _res, next) {
  const token = req.cookies?.reunite_session
  if (token) {
    const session = db
      .prepare('SELECT user_id FROM sessions WHERE token = ? AND expires > ?')
      .get(hashToken(token), Date.now())
    if (session) {
      req.user = db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(session.user_id)
      if (req.user) {
        req.user.is_admin = config.adminEmails.includes(req.user.email.toLowerCase())
      }
    }
  }
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({error: 'Sign in to continue.'})
  }
  if (!req.user.verified) {
    return res.status(403).json({error: 'Verify your VIT email first.'})
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({error: 'Sign in to continue.'})
  }
  if (!req.user.verified) {
    return res.status(403).json({error: 'Verify your VIT email first.'})
  }
  if (!config.adminEmails.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({error: 'Forbidden: Admin authorization required.'})
  }
  next()
}

/**
 * G-8: Claim rate limit per user account (10 claims per hour).
 */
export const claimRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  keyGenerator: req => req.user?.id || req.ip || 'anonymous',
  validate: {keyGeneratorIpFallback: false},
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many claim requests from this account. Please wait an hour.'
  }
})
