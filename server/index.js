import './preflight.js';

// ESM imports are hoisted, so the version check lives in preflight.js (above)
// and the app is loaded dynamically only once the Node version is confirmed.
const {app} = await import('./app.js');

const port = Number(process.env.PORT || 8080);
app.listen(port, '0.0.0.0', () =>
  console.log(`Reunite backend: http://localhost:${port}`)
);
