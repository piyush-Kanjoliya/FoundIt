import {Router} from 'express'
import {z} from 'zod'
import {randomUUID} from 'node:crypto'
import {db, transaction} from '../db.js'
import {VENUES, CATEGORIES} from '../constants.js'
import {getVenueCoordinates, isWithinCampus, isNearVenue} from '../venues.js'
import {assertNoPII, escapeLike} from '../lib/privacy.js'
import {imageUpload, storePhoto, discardPhoto, servePhoto} from '../lib/photos.js'
import {requireAuth} from '../middleware/auth.js'

export const itemsRouter = Router()

const text = (min, max) => z.string().trim().min(min).max(max)

const coordinate = (min, max) =>
  z.preprocess(
    value => (value === '' || value == null ? undefined : value),
    z.coerce.number().min(min).max(max).optional()
  )

const itemBaseSchema = z.object({
  kind: z.enum(['lost', 'found']),
  title: text(5, 100),
  description: text(15, 1000),
  category: z.enum(CATEGORIES),
  venue: z.enum(VENUES),
  occurred_on: z.iso
    .date()
    .refine(d => d <= new Date().toISOString().slice(0, 10), 'Date cannot be in the future.'),
  challenge: text(8, 250),
  expected_answer: z.preprocess(
    val => (val === '' || val == null ? undefined : val),
    text(1, 500).optional()
  ),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180)
})

const itemSchema = itemBaseSchema.superRefine((item, ctx) => {
  const hasLat = item.latitude !== undefined
  const hasLng = item.longitude !== undefined
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['latitude'],
      message: 'Choose a complete map location.'
    })
  }
})

const PUBLIC_ITEM_FIELDS =
  'id, kind, title, description, category, venue, occurred_on, challenge, status, latitude, longitude, created_at, CASE WHEN photo_key IS NOT NULL THEN 1 ELSE 0 END AS has_photo'

/**
 * Validates and defaults venue coordinates.
 */
function resolveItemCoordinates(venue, lat, lng) {
  if (lat == null && lng == null) {
    const defaultCoords = getVenueCoordinates(venue)
    return {
      latitude: defaultCoords?.latitude ?? null,
      longitude: defaultCoords?.longitude ?? null
    }
  }

  if (lat != null && lng != null) {
    if (!isWithinCampus(lat, lng)) {
      const error = new Error('Coordinates must fall within the VIT Vellore campus boundary.')
      error.status = 400
      throw error
    }
    if (!isNearVenue(venue, lat, lng)) {
      const error = new Error(
        `Selected pin location is too far from ${venue}. Please place the pin near the chosen venue.`
      )
      error.status = 400
      throw error
    }
  }

  return {latitude: lat, longitude: lng}
}

/**
 * GET /api/items (Campus board feed)
 */
itemsRouter.get('/items', (req, res, next) => {
  try {
    const q = z
      .object({
        kind: z.enum(['lost', 'found']).optional(),
        category: z.enum(CATEGORIES).optional(),
        venue: z.enum(VENUES).optional(),
        search: text(0, 100).optional(),
        sort: z.enum(['newest', 'group']).default('newest'),
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(12)
      })
      .parse(req.query)

    let where = "status = 'active'"
    const args = []

    for (const field of ['kind', 'category', 'venue']) {
      if (q[field]) {
        where += ` AND ${field} = ?`
        args.push(q[field])
      }
    }

    if (q.search) {
      const sanitized = escapeLike(q.search)
      where += " AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"
      args.push(`%${sanitized}%`, `%${sanitized}%`)
    }

    const total = db.prepare(`SELECT COUNT(*) as n FROM items WHERE ${where}`).get(...args).n

    const offset = (q.page - 1) * q.limit
    const orderBy =
      q.sort === 'group'
        ? `CASE
            WHEN venue IN ('SJT','TT','PRP','SMV','MB','GDN','CDMM') THEN 0
            WHEN venue IN ('Gazebo','Food Mall','DC') THEN 1
            WHEN venue = 'Central Library' THEN 2
            WHEN venue = 'Sports Complex' THEN 3
            WHEN venue LIKE 'MH-%' THEN 4
            WHEN venue LIKE 'LH-%' THEN 5
            ELSE 6 END, venue, created_at DESC, id`
        : 'created_at DESC, id'
    const items = db
      .prepare(
        `SELECT ${PUBLIC_ITEM_FIELDS} FROM items WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
      )
      .all(...args, q.limit, offset)

    res.json({items, total, page: q.page, pages: Math.ceil(total / q.limit)})
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/map/items (Map pins endpoint)
 */
itemsRouter.get('/map/items', (req, res, next) => {
  try {
    const q = z
      .object({
        kind: z.enum(['lost', 'found']).optional(),
        category: z.enum(CATEGORIES).optional(),
        venue: z.enum(VENUES).optional(),
        search: text(0, 100).optional()
      })
      .parse(req.query)

    let where = "status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL"
    const args = []

    for (const field of ['kind', 'category', 'venue']) {
      if (q[field]) {
        where += ` AND ${field} = ?`
        args.push(q[field])
      }
    }

    if (q.search) {
      const sanitized = escapeLike(q.search)
      where += " AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"
      args.push(`%${sanitized}%`, `%${sanitized}%`)
    }

    const total = db.prepare(`SELECT COUNT(*) as n FROM items WHERE ${where}`).get(...args).n

    const items = db
      .prepare(
        `SELECT ${PUBLIC_ITEM_FIELDS} FROM items WHERE ${where} ORDER BY created_at DESC, id LIMIT 500`
      )
      .all(...args)

    res.json({items, total})
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/stats
 */
itemsRouter.get('/stats', (_req, res) => {
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(status = 'resolved') AS resolved,
        SUM(status = 'active' AND kind = 'lost') AS lost,
        SUM(status = 'active' AND kind = 'found') AS found
      FROM items`
    )
    .get()

  res.json({
    total: stats.total || 0,
    resolved: stats.resolved || 0,
    lost: stats.lost || 0,
    found: stats.found || 0
  })
})

/**
 * POST /api/items (Create a lost or found report)
 */
itemsRouter.post('/items', requireAuth, imageUpload.single('photo'), async (req, res, next) => {
  let photoKey = null
  try {
    const input = itemSchema.parse(req.body)
    assertNoPII(`${input.title} ${input.description} ${input.challenge}`)

    const coords = resolveItemCoordinates(input.venue, input.latitude, input.longitude)

    const id = randomUUID()
    photoKey = await storePhoto(req.file)

    try {
      db.prepare(
        `INSERT INTO items (
          id, owner_id, kind, title, description, category, venue,
          occurred_on, challenge, expected_answer, latitude, longitude, photo_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        req.user.id,
        input.kind,
        input.title,
        input.description,
        input.category,
        input.venue,
        input.occurred_on,
        input.challenge,
        input.expected_answer ?? null,
        coords.latitude,
        coords.longitude,
        photoKey
      )
    } catch (err) {
      discardPhoto(photoKey)
      throw err
    }

    res.status(201).json({
      id,
      message: 'Your report is live on the campus board.'
    })
  } catch (err) {
    if (photoKey) discardPhoto(photoKey)
    next(err)
  }
})

/**
 * GET /api/items/:id (Item details)
 */
itemsRouter.get('/items/:id', (req, res, next) => {
  try {
    const item = db
      .prepare(`SELECT ${PUBLIC_ITEM_FIELDS} FROM items WHERE id = ?`)
      .get(req.params.id)

    if (!item) {
      const error = new Error('Item not found.')
      error.status = 404
      throw error
    }

    let viewer = {is_owner: false, claim_status: null}
    if (req.user) {
      const owner = db.prepare('SELECT owner_id FROM items WHERE id = ?').get(item.id)
      viewer.is_owner = owner.owner_id === req.user.id
      const claim = db
        .prepare('SELECT status FROM claims WHERE item_id = ? AND claimant_id = ?')
        .get(item.id, req.user.id)
      viewer.claim_status = claim?.status || null
    }

    res.json({item, viewer})
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/items/:id/photo
 */
itemsRouter.get('/items/:id/photo', (req, res, next) => {
  try {
    const row = db.prepare('SELECT photo_key FROM items WHERE id = ?').get(req.params.id)

    if (!row || !row.photo_key) {
      const error = new Error('Photo not found.')
      error.status = 404
      throw error
    }

    servePhoto(res, row.photo_key, next, false)
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/items/:id (G-4: Owner-only edit report)
 */
itemsRouter.patch(
  '/items/:id',
  requireAuth,
  imageUpload.single('photo'),
  async (req, res, next) => {
    let newPhotoKey = null
    try {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
      if (!item) {
        const error = new Error('Item not found.')
        error.status = 404
        throw error
      }

      if (item.owner_id !== req.user.id) {
        const error = new Error('Only the report creator can edit this report.')
        error.status = 403
        throw error
      }

      if (item.status !== 'active') {
        const error = new Error('Only active reports can be edited.')
        error.status = 409
        throw error
      }

      const approvedClaim = db
        .prepare("SELECT id FROM claims WHERE item_id = ? AND status = 'approved'")
        .get(item.id)
      if (approvedClaim) {
        const error = new Error(
          'Cannot edit an item that already has an approved claim in progress.'
        )
        error.status = 409
        throw error
      }

      const input = itemBaseSchema.partial().parse(req.body)

      const title = input.title ?? item.title
      const description = input.description ?? item.description
      const challenge = input.challenge ?? item.challenge
      assertNoPII(`${title} ${description} ${challenge}`)

      const venue = input.venue ?? item.venue
      const lat = input.latitude !== undefined ? input.latitude : item.latitude
      const lng = input.longitude !== undefined ? input.longitude : item.longitude
      const coords = resolveItemCoordinates(venue, lat, lng)

      if (req.file) {
        newPhotoKey = await storePhoto(req.file)
      }

      const finalPhotoKey = newPhotoKey || item.photo_key

      db.prepare(
        `UPDATE items SET
          title = ?, description = ?, category = ?, venue = ?,
          occurred_on = ?, challenge = ?, expected_answer = ?,
          latitude = ?, longitude = ?, photo_key = ?
        WHERE id = ?`
      ).run(
        title,
        description,
        input.category ?? item.category,
        venue,
        input.occurred_on ?? item.occurred_on,
        challenge,
        input.expected_answer !== undefined ? input.expected_answer : item.expected_answer,
        coords.latitude,
        coords.longitude,
        finalPhotoKey,
        item.id
      )

      if (newPhotoKey && item.photo_key && item.photo_key !== newPhotoKey) {
        discardPhoto(item.photo_key)
      }

      res.json({message: 'Report updated successfully.'})
    } catch (err) {
      if (newPhotoKey) discardPhoto(newPhotoKey)
      next(err)
    }
  }
)

/**
 * DELETE /api/items/:id (G-4: Owner-only delete/withdraw report)
 */
itemsRouter.delete('/items/:id', requireAuth, (req, res, next) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    if (!item) {
      const error = new Error('Item not found.')
      error.status = 404
      throw error
    }

    if (item.owner_id !== req.user.id) {
      const error = new Error('Only the report creator can delete this report.')
      error.status = 403
      throw error
    }

    if (item.status !== 'active') {
      const error = new Error('Only active reports can be deleted or withdrawn.')
      error.status = 409
      throw error
    }

    transaction(() => {
      if (item.photo_key) discardPhoto(item.photo_key)
      db.prepare('DELETE FROM items WHERE id = ?').run(item.id)
    })

    res.json({message: 'Report has been withdrawn and removed.'})
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/items/:id/resolve (Resolve item)
 */
itemsRouter.post('/items/:id/resolve', requireAuth, (req, res, next) => {
  try {
    transaction(() => {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
      if (!item) {
        const error = new Error('Item not found.')
        error.status = 404
        throw error
      }

      const approved = db
        .prepare("SELECT claimant_id FROM claims WHERE item_id = ? AND status = 'approved'")
        .get(item.id)

      const isOwner = item.owner_id === req.user.id
      const isApprovedClaimant = approved?.claimant_id === req.user.id

      if (!isOwner && !isApprovedClaimant) {
        const error = new Error('Only the reporter or approved claimant can resolve this item.')
        error.status = 403
        throw error
      }

      db.prepare("UPDATE items SET status = 'resolved' WHERE id = ?").run(item.id)
      db.prepare(
        "UPDATE claims SET status = 'rejected' WHERE item_id = ? AND status = 'pending'"
      ).run(item.id)
    })

    res.json({
      message: 'Reunited! This item has been removed from active boards.'
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/items/:id/reports (G-9: Report listing for abuse / spam)
 */
itemsRouter.post('/items/:id/reports', requireAuth, (req, res, next) => {
  try {
    const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id)
    if (!item) {
      const error = new Error('Item not found.')
      error.status = 404
      throw error
    }

    const {reason, note} = z
      .object({
        reason: z.enum(['inappropriate', 'spam', 'fake', 'pii_leak', 'other']),
        note: text(0, 500).optional()
      })
      .parse(req.body)

    const id = randomUUID()
    db.prepare(
      'INSERT INTO item_reports (id, item_id, reporter_id, reason, note) VALUES (?, ?, ?, ?, ?)'
    ).run(id, item.id, req.user.id, reason, note || null)

    res.status(201).json({
      message: 'Thank you. Your report has been submitted for campus moderator review.'
    })
  } catch (err) {
    next(err)
  }
})
