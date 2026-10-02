import nodemailer from 'nodemailer'
import {config} from '../config.js'

let transporter = null
if (config.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: Number(config.SMTP_PORT || 587),
    secure: Number(config.SMTP_PORT) === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS
    }
  })
}

/**
 * Sends an email verification link.
 */
export async function sendVerificationEmail(email, token) {
  const link = `${config.origin}/?verify=${token}`

  if (transporter) {
    try {
      await transporter.sendMail({
        from: config.SMTP_FROM,
        to: email,
        subject: 'Verify your VIT Reunite account',
        text: `Welcome to VIT Reunite!\n\nPlease verify your account within 24 hours:\n${link}\n\nIf you did not request this, please ignore this email.`
      })
      return
    } catch (err) {
      console.error('Failed to send verification email:', err)
      const error = new Error('Verification email could not be sent. Please try again.')
      error.status = 503
      throw error
    }
  }

  // Development fallback
  if (!config.isTest) {
    console.log(`\n--------------------------------------------------`)
    console.log(`[DEV] Verification link for ${email}:`)
    console.log(link)
    console.log(`--------------------------------------------------\n`)
  }
}

/**
 * Sends a password reset link.
 */
export async function sendPasswordResetEmail(email, token) {
  const link = `${config.origin}/?reset=${token}`

  if (transporter) {
    try {
      await transporter.sendMail({
        from: config.SMTP_FROM,
        to: email,
        subject: 'Reset your VIT Reunite password',
        text: `We received a request to reset your password.\n\nReset your password within 1 hour using this link:\n${link}\n\nIf you did not request this, you can safely ignore this email.`
      })
      return
    } catch (err) {
      console.error('Failed to send password reset email:', err)
      const error = new Error('Password reset email could not be sent.')
      error.status = 503
      throw error
    }
  }

  // Development fallback
  if (!config.isTest) {
    console.log(`\n--------------------------------------------------`)
    console.log(`[DEV] Password reset link for ${email}:`)
    console.log(link)
    console.log(`--------------------------------------------------\n`)
  }
}
