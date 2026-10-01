import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

import {config} from './config.js';
import {VENUES, CATEGORIES, CHECKPOINTS, VENUE_GROUPS} from './constants.js';
import {VENUE_DETAILS, CAMPUS_BOUNDS} from './venues.js';
import {checkOrigin} from './middleware/origin.js';
import {attachUser} from './middleware/auth.js';
import {errorHandler} from './middleware/errors.js';

import {authRouter} from './routes/auth.js';
import {itemsRouter} from './routes/items.js';
import {claimsRouter} from './routes/claims.js';
import {threadsRouter} from './routes/threads.js';
import {notificationsRouter} from './routes/notifications.js';
import {adminRouter} from './routes/admin.js';

export const app = express();

// Trust proxy if configured (G-11)
if (config.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// Security headers with updated CSP supporting Mapbox, MapLibre, OpenFreeMap & OSM tiles
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https://*.tile.openstreetmap.org',
          'https://tiles.openfreemap.org',
          'https://*.mapbox.com',
          'https://*.tiles.mapbox.com',
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://api.mapbox.com',
        ],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'script-src': ["'self'", "'wasm-unsafe-eval'"],
        'worker-src': ["'self'", 'blob:'],
        'child-src': ['blob:'],
        'connect-src': [
          "'self'",
          'blob:',
          'https://api.mapbox.com',
          'https://events.mapbox.com',
          'https://*.tiles.mapbox.com',
          'https://*.mapbox.com',
          'https://tiles.openfreemap.org',
          'https://*.openfreemap.org',
          'https://demotiles.maplibre.org',
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
        ],
        // Helmet's default upgrade-insecure-requests breaks http://localhost in Safari.
        'upgrade-insecure-requests': null,
      },
    },
  })
);

app.use(express.json({limit: '32kb'}));
app.use(cookieParser());

// Global API rate limit
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 150,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {error: 'Too many requests. Please wait a minute.'},
  })
);

// Origin check & session attachment
app.use('/api', checkOrigin);
app.use('/api', attachUser);

// Health check and campus metadata
app.get('/api/health', (_req, res) => res.json({ok: true}));
app.get('/api/meta', (_req, res) =>
  res.json({
    venues: VENUES,
    categories: CATEGORIES,
    checkpoints: CHECKPOINTS,
    venueGroups: VENUE_GROUPS,
    venueDetails: VENUE_DETAILS,
    campusBounds: CAMPUS_BOUNDS,
  })
);

// Mount Modular Routes
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api', claimsRouter);
app.use('/api', threadsRouter);
app.use('/api', itemsRouter);

// 404 handler for API routes
app.use('/api', (_req, res) =>
  res.status(404).json({error: 'API endpoint not found.'})
);

// Production static assets
const distPath = resolve('client/dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (_req, res) =>
    res.sendFile(resolve(distPath, 'index.html'))
  );
}

// Centralized error handler
app.use(errorHandler);
