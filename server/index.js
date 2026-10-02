import './preflight.js';

// ESM imports are hoisted, so the version check lives in preflight.js (above)
// and the app is loaded dynamically only once the Node version is confirmed.
const {app} = await import('./app.js');
const {config} = await import('./config.js');

const port = Number(process.env.PORT || 8080);
const displayHost = config.HOST === '0.0.0.0' ? 'localhost' : config.HOST;
app.listen(port, config.HOST, () => {
  console.log(`Reunite backend: http://${displayHost}:${port} (bound to ${config.HOST})`);
});
