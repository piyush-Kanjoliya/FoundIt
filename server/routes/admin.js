import {Router} from 'express';
import {db, transaction} from '../db.js';
import {requireAdmin} from '../middleware/auth.js';
import {discardPhoto} from '../lib/photos.js';

export const adminRouter = Router();

// Protect all admin routes
adminRouter.use(requireAdmin);

/**
 * GET /api/admin/reports (G-9: View reported listings)
 */
adminRouter.get('/reports', (_req, res, next) => {
  try {
    const reports = db
      .prepare(
        `SELECT
          r.id,
          r.item_id,
          r.reason,
          r.note,
          r.created_at,
          i.title AS item_title,
          i.category AS item_category,
          i.venue AS item_venue,
          i.status AS item_status
        FROM item_reports r
        LEFT JOIN items i ON i.id = r.item_id
        ORDER BY r.created_at DESC`
      )
      .all();

    res.json({reports});
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/items/:id (G-9: Remove offensive or spam listing)
 */
adminRouter.delete('/items/:id', (req, res, next) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) {
      const error = new Error('Item not found.');
      error.status = 404;
      throw error;
    }

    transaction(() => {
      if (item.photo_key) discardPhoto(item.photo_key);
      db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
    });

    res.json({message: 'Item has been removed by campus moderator.'});
  } catch (err) {
    next(err);
  }
});
