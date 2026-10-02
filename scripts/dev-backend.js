#!/usr/bin/env node
// Used by `npm run dev:lan`: expose the backend on all interfaces so phones on
// the same Wi-Fi can reach the API through the Vite dev server. Set HOST to
// override; plain `npm run dev` / `npm start` stay on 127.0.0.1.
process.env.HOST = process.env.HOST || '0.0.0.0';
await import('../server/index.js');
