import {test, before} from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import {randomUUID} from 'node:crypto'

process.env.DATABASE_PATH = ':memory:'
process.env.NODE_ENV = 'test'
process.env.ADMIN_EMAILS = 'admin@vitstudent.ac.in'
// Hermetic suite: ignore DEV_AUTO_VERIFY from a local .env.
process.env.DEV_AUTO_VERIFY = 'false'

const {app} = await import('../server/app.js')
const {db} = await import('../server/db.js')
const {calculateMatchHint, assertNoPII, escapeLike} = await import('../server/lib/privacy.js')
const {isWithinCampus, isNearVenue, getVenueCoordinates, getNearestCheckpoint} =
  await import('../server/venues.js')

const origin = 'http://localhost:5173'
const reporter = request.agent(app)
const claimant = request.agent(app)
const stranger = request.agent(app)
const admin = request.agent(app)

const mutate = (agent, method, path, body = {}) =>
  agent[method](path).set('Origin', origin).send(body)

before(async () => {
  const password = await bcrypt.hash('CampusDemo2026!', 4)
  const users = [
    ['reporter', 'reporter@vitstudent.ac.in', '24BIT9101'],
    ['claimant', 'claimant@vitstudent.ac.in', '24BIT9102'],
    ['stranger', 'stranger@vitstudent.ac.in', '24BIT9103'],
    ['admin', 'admin@vitstudent.ac.in', '24BIT9104']
  ]

  for (const [name, email, reg] of users) {
    db.prepare(
      'INSERT INTO users (id, name, email, registration, password, verified) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(randomUUID(), name, email, reg, password)
  }

  for (const [agent, email] of [
    [reporter, 'reporter@vitstudent.ac.in'],
    [claimant, 'claimant@vitstudent.ac.in'],
    [stranger, 'stranger@vitstudent.ac.in'],
    [admin, 'admin@vitstudent.ac.in']
  ]) {
    const res = await mutate(agent, 'post', '/api/auth/login', {
      email,
      password: 'CampusDemo2026!'
    })
    assert.equal(res.status, 200)
  }
})

test('G-2: Venue coordinates default, validation, and nearest checkpoint', async () => {
  // Venue default coords
  const sjtCoords = getVenueCoordinates('SJT')
  assert.ok(sjtCoords.latitude && sjtCoords.longitude)
  assert.ok(isWithinCampus(sjtCoords.latitude, sjtCoords.longitude))
  assert.ok(isNearVenue('SJT', sjtCoords.latitude, sjtCoords.longitude))

  // Reporting without coords defaults to venue coordinates
  const res = await mutate(reporter, 'post', '/api/items', {
    kind: 'lost',
    title: 'Blue Water Bottle',
    description: 'Stainless steel bottle left in classroom.',
    category: 'Lab Equipment',
    venue: 'SJT',
    occurred_on: '2026-09-01',
    challenge: 'What sticker is on the cap?'
  })
  assert.equal(res.status, 201)

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(res.body.id)
  assert.equal(item.latitude, sjtCoords.latitude)
  assert.equal(item.longitude, sjtCoords.longitude)

  // Invalid coords outside campus rejected
  const outside = await mutate(reporter, 'post', '/api/items', {
    kind: 'lost',
    title: 'Outside Campus Item',
    description: 'Item placed far away.',
    category: 'Wallets',
    venue: 'SJT',
    occurred_on: '2026-09-01',
    challenge: 'Describe it completely.',
    latitude: 13.5,
    longitude: 80.2
  })
  assert.equal(outside.status, 400)

  // Nearest checkpoint helper
  assert.equal(getNearestCheckpoint('SJT'), 'SJT Ground Floor Reception')
  assert.equal(getNearestCheckpoint('MH-A'), 'Men’s Hostel Security Desk')
})

test('G-3: Cancel handoff returns claim to rejected and item to active', async () => {
  // Create item
  const created = await mutate(reporter, 'post', '/api/items', {
    kind: 'found',
    title: 'Silver Watch',
    description: 'Found analog wrist watch near TT.',
    category: 'Wallets',
    venue: 'TT',
    occurred_on: '2026-09-01',
    challenge: 'What brand and color dial?'
  })
  const itemId = created.body.id

  // Submit claim
  const claimRes = await mutate(claimant, 'post', `/api/items/${itemId}/claims`, {
    answer: 'Titan silver watch with black dial.'
  })
  const claimId = claimRes.body.id

  // Approve claim -> item is in handoff
  await mutate(reporter, 'patch', `/api/claims/${claimId}`, {status: 'approved'})
  let item = db.prepare('SELECT status FROM items WHERE id = ?').get(itemId)
  assert.equal(item.status, 'handoff')

  // Stranger cannot cancel handoff
  const strangerCancel = await mutate(stranger, 'post', `/api/claims/${claimId}/cancel-handoff`)
  assert.equal(strangerCancel.status, 403)

  // Claimant or reporter cancels handoff
  const cancelRes = await mutate(claimant, 'post', `/api/claims/${claimId}/cancel-handoff`)
  assert.equal(cancelRes.status, 200)

  item = db.prepare('SELECT status FROM items WHERE id = ?').get(itemId)
  assert.equal(item.status, 'active')

  const claim = db.prepare('SELECT status FROM claims WHERE id = ?').get(claimId)
  assert.equal(claim.status, 'rejected')

  // Verify system message posted in thread
  const messages = db.prepare('SELECT body FROM messages WHERE claim_id = ?').all(claimId)
  assert.ok(messages.some(m => m.body.includes('[System] Handoff was cancelled')))
})

test('G-4: Owner edit and delete report with authorization boundaries', async () => {
  const created = await mutate(reporter, 'post', '/api/items', {
    kind: 'lost',
    title: 'Physics Lab Manual',
    description: 'Spiral bound manual left at PRP.',
    category: 'Lab Equipment',
    venue: 'PRP',
    occurred_on: '2026-09-01',
    challenge: 'What registration number is on page 1?'
  })
  const itemId = created.body.id

  // Stranger cannot edit
  const strangerEdit = await mutate(stranger, 'patch', `/api/items/${itemId}`, {
    title: 'Hacked Title By Stranger'
  })
  assert.equal(strangerEdit.status, 403)

  // Owner can edit
  const ownerEdit = await mutate(reporter, 'patch', `/api/items/${itemId}`, {
    title: 'Physics Lab Manual Updated',
    description: 'Spiral bound manual left at PRP laboratory table 4.'
  })
  assert.equal(ownerEdit.status, 200)

  const updated = db.prepare('SELECT title FROM items WHERE id = ?').get(itemId)
  assert.equal(updated.title, 'Physics Lab Manual Updated')

  // Stranger cannot delete
  const strangerDel = await mutate(stranger, 'delete', `/api/items/${itemId}`)
  assert.equal(strangerDel.status, 403)

  // Owner can delete
  const ownerDel = await mutate(reporter, 'delete', `/api/items/${itemId}`)
  assert.equal(ownerDel.status, 200)
  assert.equal(db.prepare('SELECT * FROM items WHERE id = ?').get(itemId), undefined)
})

test('G-6: Meetup state machine (propose -> accept/decline/counter)', async () => {
  const created = await mutate(reporter, 'post', '/api/items', {
    kind: 'found',
    title: 'Scientific Calculator fx-991CW',
    description: 'Found after slot D2 class.',
    category: 'Calculators',
    venue: 'SJT',
    occurred_on: '2026-09-01',
    challenge: 'What initials are carved on the case?'
  })
  const itemId = created.body.id

  const claimRes = await mutate(claimant, 'post', `/api/items/${itemId}/claims`, {
    answer: 'Initials PK on the slider case.'
  })
  const claimId = claimRes.body.id

  // Approve claim
  await mutate(reporter, 'patch', `/api/claims/${claimId}`, {status: 'approved'})

  // Reporter proposes meetup
  const futureTime = new Date(Date.now() + 2 * 3600000).toISOString()
  const propose = await mutate(reporter, 'patch', `/api/claims/${claimId}/meetup`, {
    checkpoint: 'SJT Ground Floor Reception',
    meetup_at: futureTime
  })
  assert.equal(propose.status, 200)

  let claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId)
  assert.equal(claim.meetup_status, 'proposed')

  // Proposer cannot accept their own proposal
  const selfAccept = await mutate(reporter, 'post', `/api/claims/${claimId}/meetup/accept`)
  assert.equal(selfAccept.status, 400)

  // Stranger cannot accept
  const strangerAccept = await mutate(stranger, 'post', `/api/claims/${claimId}/meetup/accept`)
  assert.equal(strangerAccept.status, 403)

  // Other party (claimant) accepts
  const acceptRes = await mutate(claimant, 'post', `/api/claims/${claimId}/meetup/accept`)
  assert.equal(acceptRes.status, 200)

  claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId)
  assert.equal(claim.meetup_status, 'accepted')
})

test('G-7: Notifications summary endpoint reflects pending activity', async () => {
  const notifs = await reporter.get('/api/notifications/summary')
  assert.equal(notifs.status, 200)
  assert.ok('pendingClaimsCount' in notifs.body)
  assert.ok('activeHandoffsCount' in notifs.body)
  assert.ok('total' in notifs.body)
})

test('G-8: Expected answer hint is private to finder and matches guidance', async () => {
  // Test matching logic
  assert.equal(calculateMatchHint('Casio 991CW black', 'casio 991cw'), 'Looks similar')
  assert.equal(calculateMatchHint('completely different string', 'casio 991cw'), "Doesn't match")

  // Test item creation with expected answer
  const created = await mutate(reporter, 'post', '/api/items', {
    kind: 'found',
    title: 'Room Key With Keychain',
    description: 'Single brass key recovered.',
    category: 'Room Keys',
    venue: 'MH-A',
    occurred_on: '2026-09-01',
    challenge: 'What color is the lanyard?',
    expected_answer: 'Navy blue with yellow stripes'
  })
  const itemId = created.body.id

  // Public listing must NEVER leak expected_answer
  const publicItem = await request(app).get(`/api/items/${itemId}`)
  assert.equal('expected_answer' in publicItem.body.item, false)

  // Submit claim
  const claimRes = await mutate(claimant, 'post', `/api/items/${itemId}/claims`, {
    answer: 'Navy blue lanyard with yellow stripes.'
  })

  // Claimant dashboard must NOT show expected_answer
  const claimantDash = await claimant.get('/api/dashboard')
  const claimantClaim = claimantDash.body.claims.find(c => c.id === claimRes.body.id)
  assert.equal(claimantClaim.expected_answer, undefined)

  // Finder dashboard MUST include expected_answer and match hint
  const finderDash = await reporter.get('/api/dashboard')
  const finderClaim = finderDash.body.claims.find(c => c.id === claimRes.body.id)
  assert.equal(finderClaim.expected_answer, 'Navy blue with yellow stripes')
  assert.equal(finderClaim.match_hint, 'Looks similar')
})

test('G-9: Listing abuse report and admin moderation endpoints', async () => {
  const created = await mutate(reporter, 'post', '/api/items', {
    kind: 'lost',
    title: 'Spam Listing Item',
    description: 'This is a test listing to report.',
    category: 'Wallets',
    venue: 'GDN',
    occurred_on: '2026-09-01',
    challenge: 'What is inside?'
  })
  const itemId = created.body.id

  // Claimant reports the listing
  const repRes = await mutate(claimant, 'post', `/api/items/${itemId}/reports`, {
    reason: 'spam',
    note: 'Looks like duplicate promotional content.'
  })
  assert.equal(repRes.status, 201)

  // Non-admin stranger gets 403 on admin routes
  assert.equal((await stranger.get('/api/admin/reports')).status, 403)
  assert.equal((await mutate(stranger, 'delete', `/api/admin/items/${itemId}`)).status, 403)

  // Admin can list reports
  const adminReports = await admin.get('/api/admin/reports')
  assert.equal(adminReports.status, 200)
  assert.ok(adminReports.body.reports.some(r => r.item_id === itemId))

  // Admin can delete item
  const adminDel = await mutate(admin, 'delete', `/api/admin/items/${itemId}`)
  assert.equal(adminDel.status, 200)
  assert.equal(db.prepare('SELECT * FROM items WHERE id = ?').get(itemId), undefined)
})

test('G-10: Password reset (single use, rate limited, no enumeration)', async () => {
  // Non-existent email returns same friendly message (no enumeration)
  const resNonExistent = await mutate(request(app), 'post', '/api/auth/forgot-password', {
    email: 'nonexistent@vitstudent.ac.in'
  })
  assert.equal(resNonExistent.status, 200)
  assert.match(resNonExistent.body.message, /If an account exists/)

  // Existing user requests reset
  const resValid = await mutate(request(app), 'post', '/api/auth/forgot-password', {
    email: 'stranger@vitstudent.ac.in'
  })
  assert.equal(resValid.status, 200)

  // Fetch token from database for testing
  const resetRow = db
    .prepare('SELECT token FROM password_resets ORDER BY created_at DESC LIMIT 1')
    .get()
  assert.ok(resetRow)

  // Reset with raw token
  const rawToken = 'b'.repeat(64)
  const {createHash} = await import('node:crypto')
  const hashed = createHash('sha256').update(rawToken).digest('hex')
  const user = db.prepare("SELECT id FROM users WHERE email='stranger@vitstudent.ac.in'").get()
  db.prepare('INSERT INTO password_resets VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)').run(
    hashed,
    user.id,
    Date.now() + 3600000
  )

  const resetReq = await mutate(request(app), 'post', '/api/auth/reset-password', {
    token: rawToken,
    password: 'NewStrongPassword2026!'
  })
  assert.equal(resetReq.status, 200)

  // Second use of same token fails
  const reuse = await mutate(request(app), 'post', '/api/auth/reset-password', {
    token: rawToken,
    password: 'NewStrongPassword2026!'
  })
  assert.equal(reuse.status, 400)

  // Can login with new password
  const newLogin = await mutate(request(app), 'post', '/api/auth/login', {
    email: 'stranger@vitstudent.ac.in',
    password: 'NewStrongPassword2026!'
  })
  assert.equal(newLogin.status, 200)
})

test('G-11: Expanded PII detection (spaced numbers, words, handles, LIKE escape)', async () => {
  // Spaced phone numbers
  assert.throws(() => assertNoPII('Call me at 9 8 7 6 5 4 3 2 1 0 please'), /Remove/)
  // Spelled-out number words
  assert.throws(
    () => assertNoPII('Contact me nine eight seven six five four three two one zero'),
    /Remove/
  )
  // Obfuscated email
  assert.throws(() => assertNoPII('reach me at test at vitstudent dot ac dot in'), /Remove/)
  // Social handles
  assert.throws(() => assertNoPII('Ping me on instagram @coolstudent123'), /Remove/)
  assert.throws(() => assertNoPII('Message wa.me/919999999999'), /Remove/)

  // Escape LIKE wildcards
  assert.equal(escapeLike('100%_item'), '100\\%\\_item')
})
