import {Router} from 'express'
import {z} from 'zod'
import {randomUUID} from 'node:crypto'
import {db, transaction} from '../db.js'
import {CHECKPOINTS} from '../constants.js'
import {imageUpload, storePhoto, discardPhoto, servePhoto} from '../lib/photos.js'
import {requireAuth, claimRateLimit} from '../middleware/auth.js'
import {calculateMatchHint} from '../lib/privacy.js'

export const claimsRouter = Router()

const text = (min, max) => z.string().trim().min(min).max(max)

export function getClaimForUser(claimId, userId) {
  const claim = db
    .prepare(
      `SELECT
        c.*,
        i.owner_id,
        i.status AS item_status,
        i.title,
        i.expected_answer
      FROM claims c
      JOIN items i ON i.id = c.item_id
      WHERE c.id = ?`
    )
    .get(claimId)

  if (!claim) {
    const error = new Error('Request not found.')
    error.status = 404
    throw error
  }

  if (claim.owner_id !== userId && claim.claimant_id !== userId) {
    const error = new Error('You do not have access to this request.')
    error.status = 403
    throw error
  }

  return claim
}

/**
 * POST /api/items/:id/claims (Submit verification request)
 */
claimsRouter.post(
  '/items/:id/claims',
  requireAuth,
  claimRateLimit,
  imageUpload.single('photo'),
  async (req, res, next) => {
    let photoKey = null
    try {
      const {answer} = z.object({answer: text(10, 1500)}).parse(req.body)

      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)

      if (!item) {
        const error = new Error('Item not found.')
        error.status = 404
        throw error
      }

      if (item.owner_id === req.user.id) {
        const error = new Error('You cannot claim your own report.')
        error.status = 400
        throw error
      }

      if (item.status !== 'active') {
        const error = new Error('This report is no longer accepting claims.')
        error.status = 409
        throw error
      }

      const existingClaim = db
        .prepare('SELECT id FROM claims WHERE item_id = ? AND claimant_id = ?')
        .get(item.id, req.user.id)

      if (existingClaim) {
        const error = new Error('You have already submitted a request for this item.')
        error.status = 409
        throw error
      }

      const id = randomUUID()
      photoKey = await storePhoto(req.file)

      try {
        db.prepare(
          `INSERT INTO claims (
            id, item_id, claimant_id, answer, proof_photo_key
          ) VALUES (?, ?, ?, ?, ?)`
        ).run(id, item.id, req.user.id, answer, photoKey)
      } catch (err) {
        discardPhoto(photoKey)
        throw err
      }

      res.status(201).json({
        id,
        message: 'Your private verification request has been submitted.'
      })
    } catch (err) {
      if (photoKey) discardPhoto(photoKey)
      next(err)
    }
  }
)

/**
 * GET /api/claims/:id/proof-photo (Private proof photo)
 */
claimsRouter.get('/claims/:id/proof-photo', requireAuth, (req, res, next) => {
  try {
    const claim = getClaimForUser(req.params.id, req.user.id)
    if (!claim.proof_photo_key) {
      const error = new Error('No proof photo attached to this claim.')
      error.status = 404
      throw error
    }
    servePhoto(res, claim.proof_photo_key, next, true)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/claims/:id (Approve or Reject verification request)
 */
claimsRouter.patch('/claims/:id', requireAuth, (req, res, next) => {
  try {
    const {status, note} = z
      .object({
        status: z.enum(['approved', 'rejected']),
        note: z.string().trim().max(500).optional()
      })
      .parse(req.body)

    transaction(() => {
      const claim = getClaimForUser(req.params.id, req.user.id)

      if (claim.owner_id !== req.user.id) {
        const error = new Error('Only the reporter can review this request.')
        error.status = 403
        throw error
      }

      if (claim.status !== 'pending' || claim.item_status !== 'active') {
        const error = new Error(
          'This request has already been reviewed or the item is unavailable.'
        )
        error.status = 409
        throw error
      }

      db.prepare('UPDATE claims SET status = ?, review_note = ? WHERE id = ?').run(
        status,
        note || null,
        claim.id
      )

      if (status === 'approved') {
        db.prepare("UPDATE items SET status = 'handoff' WHERE id = ?").run(claim.item_id)
        // Automatically reject all other pending claims on this item
        db.prepare(
          "UPDATE claims SET status = 'rejected' WHERE item_id = ? AND id <> ? AND status = 'pending'"
        ).run(claim.item_id, claim.id)
      }
    })

    res.json({
      message:
        status === 'approved'
          ? 'Approved. Your private handoff thread is ready.'
          : 'Request rejected.'
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/claims/:id/cancel-handoff (G-3: Cancel handoff)
 * Returns claim to rejected, item to active, posts system message
 */
claimsRouter.post('/claims/:id/cancel-handoff', requireAuth, (req, res, next) => {
  try {
    transaction(() => {
      const claim = getClaimForUser(req.params.id, req.user.id)

      if (claim.status !== 'approved' || claim.item_status !== 'handoff') {
        const error = new Error('Only approved handoffs in progress can be cancelled.')
        error.status = 409
        throw error
      }

      const role = claim.owner_id === req.user.id ? 'reporter' : 'claimant'

      // Set claim to rejected
      db.prepare(
        "UPDATE claims SET status = 'rejected', meetup_status = 'declined' WHERE id = ?"
      ).run(claim.id)

      // Return item to active so others can claim or reporter can re-list
      db.prepare("UPDATE items SET status = 'active' WHERE id = ?").run(claim.item_id)

      // System message
      db.prepare('INSERT INTO messages (id, claim_id, sender_id, body) VALUES (?, ?, ?, ?)').run(
        randomUUID(),
        claim.id,
        req.user.id,
        `[System] Handoff was cancelled by the ${role}. The item has been returned to the campus board.`
      )
    })

    res.json({
      message: 'Handoff cancelled. Item has returned to the campus board.'
    })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/claims/:id/meetup (G-6: Propose or counter meetup)
 */
claimsRouter.patch('/claims/:id/meetup', requireAuth, (req, res, next) => {
  try {
    const {checkpoint, meetup_at} = z
      .object({
        checkpoint: z.enum(CHECKPOINTS),
        meetup_at: z.iso
          .datetime({offset: true})
          .refine(s => Date.parse(s) > Date.now(), 'Choose a future meetup time.')
      })
      .parse(req.body)

    const claim = getClaimForUser(req.params.id, req.user.id)
    if (claim.status !== 'approved' || claim.item_status === 'resolved') {
      const error = new Error('This handoff is closed.')
      error.status = 409
      throw error
    }

    const isCounter = Boolean(claim.checkpoint)
    const newStatus = isCounter ? 'countered' : 'proposed'

    db.prepare(
      `UPDATE claims SET
        checkpoint = ?, meetup_at = ?, meetup_status = ?, meetup_proposer_id = ?
      WHERE id = ?`
    ).run(checkpoint, meetup_at, newStatus, req.user.id, claim.id)

    // Notify in thread
    const role = claim.owner_id === req.user.id ? 'Reporter' : 'Claimant'
    db.prepare('INSERT INTO messages (id, claim_id, sender_id, body) VALUES (?, ?, ?, ?)').run(
      randomUUID(),
      claim.id,
      req.user.id,
      `[System] ${role} proposed meetup checkpoint at ${checkpoint} on ${new Date(
        meetup_at
      ).toLocaleString('en-IN')}. Please confirm or counter.`
    )

    res.json({
      message: 'Meetup proposal updated. Confirm the time with the other student in the thread.'
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/claims/:id/meetup/accept (G-6: Accept meetup)
 */
claimsRouter.post('/claims/:id/meetup/accept', requireAuth, (req, res, next) => {
  try {
    const claim = getClaimForUser(req.params.id, req.user.id)
    if (claim.status !== 'approved' || claim.item_status === 'resolved') {
      const error = new Error('This handoff is closed.')
      error.status = 409
      throw error
    }

    if (!claim.checkpoint || !claim.meetup_at) {
      const error = new Error('No meetup has been proposed yet.')
      error.status = 400
      throw error
    }

    if (claim.meetup_proposer_id === req.user.id) {
      const error = new Error('You cannot accept your own proposal.')
      error.status = 400
      throw error
    }

    db.prepare("UPDATE claims SET meetup_status = 'accepted' WHERE id = ?").run(claim.id)

    const role = claim.owner_id === req.user.id ? 'Reporter' : 'Claimant'
    db.prepare('INSERT INTO messages (id, claim_id, sender_id, body) VALUES (?, ?, ?, ?)').run(
      randomUUID(),
      claim.id,
      req.user.id,
      `[System] ${role} accepted the meetup checkpoint at ${claim.checkpoint}.`
    )

    res.json({message: 'Meetup accepted and confirmed!'})
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/claims/:id/meetup/decline (G-6: Decline meetup)
 */
claimsRouter.post('/claims/:id/meetup/decline', requireAuth, (req, res, next) => {
  try {
    const claim = getClaimForUser(req.params.id, req.user.id)
    if (claim.status !== 'approved' || claim.item_status === 'resolved') {
      const error = new Error('This handoff is closed.')
      error.status = 409
      throw error
    }

    if (claim.meetup_proposer_id === req.user.id) {
      const error = new Error('You cannot decline your own proposal.')
      error.status = 400
      throw error
    }

    db.prepare("UPDATE claims SET meetup_status = 'declined' WHERE id = ?").run(claim.id)

    const role = claim.owner_id === req.user.id ? 'Reporter' : 'Claimant'
    db.prepare('INSERT INTO messages (id, claim_id, sender_id, body) VALUES (?, ?, ?, ?)').run(
      randomUUID(),
      claim.id,
      req.user.id,
      `[System] ${role} declined the proposed meetup time/checkpoint. Please propose a new one.`
    )

    res.json({message: 'Meetup proposal declined.'})
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/dashboard (User activity dashboard)
 */
claimsRouter.get('/dashboard', requireAuth, (req, res, next) => {
  try {
    const items = db
      .prepare('SELECT * FROM items WHERE owner_id = ? ORDER BY created_at DESC')
      .all(req.user.id)
      .map(({owner_id, photo_key, ...i}) => ({
        ...i,
        has_photo: Boolean(photo_key)
      }))

    const rawClaims = db
      .prepare(
        `SELECT
          c.*,
          i.title,
          i.kind,
          i.status AS item_status,
          i.challenge,
          i.expected_answer,
          i.owner_id,
          CASE WHEN i.owner_id = ? THEN 'reporter' ELSE 'claimant' END AS role
        FROM claims c
        JOIN items i ON i.id = c.item_id
        WHERE i.owner_id = ? OR c.claimant_id = ?
        ORDER BY c.created_at DESC`
      )
      .all(req.user.id, req.user.id, req.user.id)

    const claims = rawClaims.map(
      ({claimant_id, proof_photo_key, expected_answer, owner_id, meetup_proposer_id, ...c}) => {
        const isReporter = owner_id === req.user.id
        return {
          ...c,
          has_proof_photo: Boolean(proof_photo_key),
          meetup_mine: meetup_proposer_id === req.user.id,
          expected_answer: isReporter ? expected_answer || null : undefined,
          match_hint: isReporter ? calculateMatchHint(c.answer, expected_answer) : undefined
        }
      }
    )

    res.json({items, claims})
  } catch (err) {
    next(err)
  }
})
