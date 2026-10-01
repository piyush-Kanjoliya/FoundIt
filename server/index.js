import {app} from './app.js';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    `\x1b[31mError: Node.js version ${process.version} is not supported. VIT Reunite requires Node.js >= 22.13 (Node 24 recommended in .nvmrc).\x1b[0m`
  );
  process.exit(1);
}

const port = Number(process.env.PORT || 8080);
app.listen(port, '0.0.0.0', () =>
  console.log(`Reunite backend: http://localhost:${port}`)
);
