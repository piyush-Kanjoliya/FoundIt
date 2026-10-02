/**
 * Imported first by server/index.js so the friendly version message prints
 * before any unsupported-feature import can crash old Node versions with a
 * raw syntax/runtime error. Keep this file dependency-free.
 */

const MIN_MAJOR = 22;
const MIN_MINOR = 13;

export function isSupportedNode(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);
}

if (!isSupportedNode()) {
  console.error(
    `\x1b[31mError: Node.js v${process.versions.node} is not supported. ` +
      `VIT Reunite requires Node.js >= ${MIN_MAJOR}.${MIN_MINOR} ` +
      `(Node 24 recommended, see .nvmrc). Update Node and try again.\x1b[0m`
  );
  process.exit(1);
}
