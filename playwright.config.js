import {defineConfig} from '@playwright/test'
import {createServer} from 'node:net'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

// Pick a genuinely free port so parallel runs and CI never collide.
function freePort() {
  return new Promise(resolve => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address()
      server.close(() => resolve(port))
    })
  })
}

// Playwright evaluates this config file in the main process and again in every
// worker. Random choices made at module top level would therefore differ per
// process, so the first evaluation fixes the session in the environment; the
// worker processes inherit it. Every `playwright test` invocation gets a fresh
// port and a throwaway database directory.
function resolveSession() {
  if (process.env.REUNITE_E2E_PORT && process.env.REUNITE_E2E_WORKDIR) {
    return {
      port: Number(process.env.REUNITE_E2E_PORT),
      workDir: process.env.REUNITE_E2E_WORKDIR
    }
  }
  const session = {
    port: null,
    workDir: mkdtempSync(join(tmpdir(), 'reunite-e2e-'))
  }
  return new Promise(resolve => {
    freePort().then(port => {
      session.port = port
      process.env.REUNITE_E2E_PORT = String(port)
      process.env.REUNITE_E2E_WORKDIR = session.workDir
      resolve(session)
    })
  })
}

const {port, workDir} = await resolveSession()
const databasePath = join(workDir, 'e2e.sqlite')
const uploadsDir = join(workDir, 'uploads')
export const baseURL = `http://127.0.0.1:${port}`

// The Express server serves the built client from client/dist and the API from
// one origin. A temporary file database is bootstrapped, seeded and thrown away
// per run; DEV_AUTO_VERIFY lets freshly registered accounts sign in at once.
const env =
  `PORT=${port} DATABASE_PATH=${databasePath} UPLOADS_DIR=${uploadsDir} ` +
  `NODE_ENV=development DEV_AUTO_VERIFY=true APP_ORIGIN=${baseURL}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {timeout: 10_000},
  // Server state (one SQLite file) is shared, so tests must not race.
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata'
  },
  webServer: {
    command:
      `${env} node scripts/bootstrap.js && ` +
      `${env} node scripts/seed.js && ` +
      `${env} npm start`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
})
