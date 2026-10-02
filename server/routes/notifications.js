import {Router} from 'express'
import {db} from '../db.js'
import {requireAuth} from '../middleware/auth.js'

export const notificationsRouter = Router()

/**
 * GET /api/notifications/summary (G-7: Polled summary of pending activity)
 */
notificationsRouter.get('/summary', requireAuth, (req, res, next) => {
  try {
    const userId = req.user.id

    // Number of pending claims on items reported by this user that need review
    const pendingClaims = db
      .prepare(
        `SELECT COUNT(*) AS count
        FROM claims c
        JOIN items i ON i.id = c.item_id
        WHERE i.owner_id = ? AND c.status = 'pending'`
      )
      .get(userId).count

    // Number of active handoffs in progress
    const activeHandoffs = db
      .prepare(
        `SELECT COUNT(*) AS count
        FROM claims c
        JOIN items i ON i.id = c.item_id
        WHERE (i.owner_id = ? OR c.claimant_id = ?)
          AND c.status = 'approved'
          AND i.status = 'handoff'`
      )
      .get(userId, userId).count

    // Proposals waiting for user's response
    const pendingMeetupResponses = db
      .prepare(
        `SELECT COUNT(*) AS count
        FROM claims c
        JOIN items i ON i.id = c.item_id
        WHERE (i.owner_id = ? OR c.claimant_id = ?)
          AND c.status = 'approved'
          AND i.status = 'handoff'
          AND c.meetup_status IN ('proposed', 'countered')
          AND c.meetup_proposer_id <> ?`
      )
      .get(userId, userId, userId).count

    const unreadMessages = db
      .prepare(
        `SELECT COUNT(*) AS count
        FROM messages m
        JOIN claims c ON c.id = m.claim_id
        JOIN items i ON i.id = c.item_id
        LEFT JOIN thread_reads r
          ON r.claim_id = c.id AND r.user_id = ?
        WHERE (i.owner_id = ? OR c.claimant_id = ?)
          AND c.status = 'approved'
          AND m.sender_id <> ?
          AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)`
      )
      .get(userId, userId, userId, userId).count

    res.json({
      pendingClaimsCount: pendingClaims,
      activeHandoffsCount: activeHandoffs,
      pendingMeetupResponses,
      unreadMessagesCount: unreadMessages,
      total: pendingClaims + pendingMeetupResponses + unreadMessages
    })
  } catch (err) {
    next(err)
  }
})
