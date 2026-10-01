import {Router} from 'express';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {db} from '../db.js';
import {requireAuth} from '../middleware/auth.js';
import {assertNoPII} from '../lib/privacy.js';
import {getClaimForUser} from './claims.js';

export const threadsRouter = Router();

const text = (min, max) => z.string().trim().min(min).max(max);

/**
 * GET /api/claims/:id/thread (Retrieve messages for an approved claim)
 */
threadsRouter.get('/claims/:id/thread', requireAuth, (req, res, next) => {
  try {
    const claim = getClaimForUser(req.params.id, req.user.id);

    if (claim.status !== 'approved') {
      const error = new Error('Messages unlock only after approval.');
      error.status = 403;
      throw error;
    }

    const messages = db
      .prepare(
        `SELECT id, body, created_at, sender_id
        FROM messages
        WHERE claim_id = ?
        ORDER BY created_at ASC, id ASC`
      )
      .all(claim.id)
      .map(({sender_id, ...m}) => ({
        ...m,
        mine: sender_id === req.user.id,
        label:
          m.body.startsWith('[System]')
            ? 'System'
            : sender_id === claim.owner_id
              ? 'Reporter'
              : 'Claimant',
      }));

    db.prepare(
      `INSERT INTO thread_reads (user_id, claim_id, last_read_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, claim_id)
       DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`
    ).run(req.user.id, claim.id);

    res.json({
      claim: {
        id: claim.id,
        item_id: claim.item_id,
        title: claim.title,
        checkpoint: claim.checkpoint,
        meetup_at: claim.meetup_at,
        meetup_status: claim.meetup_status || 'proposed',
        meetup_mine: claim.meetup_proposer_id === req.user.id,
        item_status: claim.item_status,
        my_role: claim.owner_id === req.user.id ? 'reporter' : 'claimant',
      },
      messages,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/claims/:id/messages (Send message in approved claim thread)
 */
threadsRouter.post('/claims/:id/messages', requireAuth, (req, res, next) => {
  try {
    const {body} = z.object({body: text(1, 1500)}).parse(req.body);

    // G-11: Screen for PII in chat messages too
    assertNoPII(body);

    const claim = getClaimForUser(req.params.id, req.user.id);

    if (claim.status !== 'approved' || claim.item_status === 'resolved') {
      const error = new Error('This handoff is not open for messages.');
      error.status = 409;
      throw error;
    }

    db.prepare(
      'INSERT INTO messages (id, claim_id, sender_id, body) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), claim.id, req.user.id, body);

    res.status(201).json({message: 'Message sent.'});
  } catch (err) {
    next(err);
  }
});
