import {networkInterfaces} from 'node:os';

const nets = networkInterfaces();
const urls = [];
for (const list of Object.values(nets)) {
  for (const net of list || []) {
    if (net.family === 'IPv4' && !net.internal) {
      urls.push(`http://${net.address}:5173`);
    }
  }
}

console.log('\nVIT Reunite LAN mode');
console.log('Frontend binds to 0.0.0.0:5173 (all interfaces).');
if (urls.length) {
  console.log('Open on a phone:');
  for (const url of urls) console.log(`  ${url}`);
} else {
  console.log('No LAN IPv4 address found.');
}
console.log(
  'Geolocation on a phone requires HTTPS. Use mkcert + vite --https, or test location on localhost.\n'
);
