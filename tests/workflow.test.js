import {test, before} from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'
import {randomUUID} from 'node:crypto'
process.env.DATABASE_PATH = ':memory:'
process.env.NODE_ENV = 'test'
// Keep the suite hermetic: a copied .env (e.g. from .env.example) may enable
// dev auto-verification, which would flip the sign-in gating assertions.
process.env.DEV_AUTO_VERIFY = 'false'
const {app} = await import('../server/app.js')
const {db} = await import('../server/db.js')
const origin = 'http://localhost:5173'
const finder = request.agent(app),
  student = request.agent(app),
  stranger = request.agent(app)
const mutate = (agent, method, path, body = {}) =>
  agent[method](path).set('Origin', origin).send(body)
before(async () => {
  const password = await bcrypt.hash('CampusDemo2026!', 4)
  for (const [n, reg] of [
    ['finder', '24BIT9001'],
    ['student', '24BIT9002'],
    ['stranger', '24BIT9003']
  ])
    db.prepare(
      'INSERT INTO users(id,name,email,registration,password,verified) VALUES(?,?,?,?,?,1)'
    ).run(randomUUID(), n, `${n}@vitstudent.ac.in`, reg, password)
  for (const [agent, n] of [
    [finder, 'finder'],
    [student, 'student'],
    [stranger, 'stranger']
  ])
    assert.equal(
      (
        await mutate(agent, 'post', '/api/auth/login', {
          email: `${n}@vitstudent.ac.in`,
          password: 'CampusDemo2026!'
        })
      ).status,
      200
    )
})
const item = {
  kind: 'found',
  title: 'Casio calculator',
  description: 'Black calculator recovered after class.',
  category: 'Calculators',
  venue: 'SJT',
  occurred_on: '2026-09-01',
  challenge: 'What is written on the back?',
  latitude: 12.9702,
  longitude: 79.1568
}
test('complete private recovery lifecycle and authorization boundaries', async () => {
  const created = await mutate(finder, 'post', '/api/items', item)
  assert.equal(created.status, 201)
  const id = created.body.id
  const board = await request(app).get('/api/items')
  assert.equal(board.body.items.length, 1)
  assert.equal(board.body.items[0].latitude, 12.9702)
  assert.equal(board.body.items[0].longitude, 79.1568)
  for (const field of ['owner_id', 'registration', 'email', 'phone', 'name'])
    assert.equal(field in board.body.items[0], false)
  const map = await request(app).get('/api/map/items?kind=found')
  assert.equal(map.body.total, 1)
  assert.equal(map.body.items[0].id, id)
  assert.equal((await request(app).get('/api/map/items?kind=lost')).body.total, 0)
  assert.equal(
    (await mutate(finder, 'post', `/api/items/${id}/claims`, {answer: 'My own item.'})).status,
    400
  )
  const c = await mutate(student, 'post', `/api/items/${id}/claims`, {
    answer: 'The back has a blue star sticker.'
  })
  assert.equal(c.status, 201)
  const claim = c.body.id
  assert.equal((await student.get(`/api/claims/${claim}/thread`)).status, 403)
  assert.equal(
    (await mutate(student, 'patch', `/api/claims/${claim}`, {status: 'approved'})).status,
    403
  )
  assert.equal(
    (await mutate(stranger, 'patch', `/api/claims/${claim}`, {status: 'rejected'})).status,
    403
  )
  assert.equal(
    (await mutate(student, 'post', `/api/items/${id}/claims`, {answer: 'Another request answer.'}))
      .status,
    409
  )
  const c2 = await mutate(stranger, 'post', `/api/items/${id}/claims`, {
    answer: 'My calculator has a red label.'
  })
  assert.equal(c2.status, 201)
  assert.equal(
    (await mutate(finder, 'patch', `/api/claims/${claim}`, {status: 'approved'})).status,
    200
  )
  assert.equal((await request(app).get('/api/items')).body.total, 0)
  assert.equal(
    db.prepare('SELECT status FROM claims WHERE id=?').get(c2.body.id).status,
    'rejected'
  )
  assert.equal((await stranger.get(`/api/claims/${claim}/thread`)).status, 403)
  assert.equal(
    (
      await mutate(student, 'post', `/api/claims/${claim}/messages`, {
        body: 'Let us meet at the library security desk.'
      })
    ).status,
    201
  )
  const thread = await finder.get(`/api/claims/${claim}/thread`)
  assert.equal(thread.body.messages[0].label, 'Claimant')
  assert.equal('sender_id' in thread.body.messages[0], false)
  const dashboard = await finder.get('/api/dashboard')
  assert.equal('claimant_id' in dashboard.body.claims[0], false)
  assert.equal(
    (
      await mutate(student, 'patch', `/api/claims/${claim}/meetup`, {
        checkpoint: 'Central Library Security Desk',
        meetup_at: new Date(Date.now() + 3600000).toISOString()
      })
    ).status,
    200
  )
  assert.equal((await mutate(stranger, 'post', `/api/items/${id}/resolve`)).status, 403)
  assert.equal((await mutate(student, 'post', `/api/items/${id}/resolve`)).status, 200)
  assert.equal((await request(app).get('/api/items')).body.total, 0)
  assert.equal(
    (await mutate(finder, 'post', `/api/claims/${claim}/messages`, {body: 'Another message.'}))
      .status,
    409
  )
})
test('report photo is public and ownership proof stays restricted to both parties', async () => {
  const png = await sharp({create: {width: 2, height: 2, channels: 3, background: '#c6d9c1'}})
    .png()
    .toBuffer()
  let report = finder.post('/api/items').set('Origin', origin)
  for (const [key, value] of Object.entries(item)) report = report.field(key, String(value))
  const created = await report.attach('photo', png, {
    filename: 'calculator.png',
    contentType: 'image/png'
  })
  assert.equal(created.status, 201)
  const id = created.body.id
  const listing = await request(app).get(`/api/items/${id}`)
  assert.equal(listing.body.item.has_photo, 1)
  assert.equal('photo_key' in listing.body.item, false)
  const publicPhoto = await request(app).get(`/api/items/${id}/photo`)
  assert.equal(publicPhoto.status, 200)
  assert.match(publicPhoto.headers['content-type'], /image\/webp/)
  assert.equal((await sharp(publicPhoto.body).metadata()).exif, undefined)
  const claimRequest = student
    .post(`/api/items/${id}/claims`)
    .set('Origin', origin)
    .field('answer', 'A white mark is on the lower corner.')
    .attach('photo', png, {filename: 'proof.png', contentType: 'image/png'})
  const submitted = await claimRequest
  assert.equal(submitted.status, 201)
  const claimId = submitted.body.id
  for (const agent of [finder, student]) {
    const dashboard = await agent.get('/api/dashboard')
    const ownClaim = dashboard.body.claims.find(c => c.id === claimId)
    assert.equal(ownClaim.has_proof_photo, true)
    assert.equal('proof_photo_key' in ownClaim, false)
    const proof = await agent.get(`/api/claims/${claimId}/proof-photo`)
    assert.equal(proof.status, 200)
    assert.equal(proof.headers['cache-control'], 'private, no-store')
    assert.equal((await sharp(proof.body).metadata()).exif, undefined)
  }
  assert.equal((await stranger.get(`/api/claims/${claimId}/proof-photo`)).status, 403)
  assert.equal((await request(app).get(`/api/claims/${claimId}/proof-photo`)).status, 401)
  const ownerDashboard = await finder.get('/api/dashboard')
  const ownItem = ownerDashboard.body.items.find(i => i.id === id)
  assert.equal(ownItem.has_photo, true)
  assert.equal('photo_key' in ownItem, false)
  const invalid = finder.post('/api/items').set('Origin', origin)
  for (const [key, value] of Object.entries(item)) invalid.field(key, String(value))
  assert.equal(
    (
      await invalid.attach('photo', Buffer.from('not an image'), {
        filename: 'image.png',
        contentType: 'image/png'
      })
    ).status,
    415
  )
})
test('validation, anonymity and origin protection', async () => {
  assert.equal(
    (await mutate(finder, 'post', '/api/items', {...item, venue: 'Outside campus'})).status,
    400
  )
  assert.equal((await mutate(finder, 'post', '/api/items', {...item, latitude: 120})).status, 400)
  assert.equal(
    (await mutate(finder, 'post', '/api/items', {...item, longitude: undefined})).status,
    400
  )
  assert.equal(
    (
      await mutate(finder, 'post', '/api/items', {
        ...item,
        description: 'Email finder@vitstudent.ac.in for return.'
      })
    ).status,
    400
  )
  assert.equal(
    (await finder.post('/api/items').set('Origin', 'https://evil.example').send(item)).status,
    403
  )
  assert.equal((await mutate(request(app), 'post', '/api/items', item)).status, 401)
  assert.equal((await request(app).get('/api/items?page=-1')).status, 400)
  assert.equal(
    (
      await mutate(request(app), 'post', '/api/auth/register', {
        name: 'Student',
        email: 'student@gmail.com',
        registration: '24BIT9100',
        password: 'StrongPassword1!'
      })
    ).status,
    400
  )
})
test('reject workflow and reporter resolution', async () => {
  const a = await mutate(finder, 'post', '/api/items', {...item, kind: 'lost'})
  const c = await mutate(student, 'post', `/api/items/${a.body.id}/claims`, {
    answer: 'I recovered the calculator near SJT.'
  })
  assert.equal(
    (await mutate(finder, 'patch', `/api/claims/${c.body.id}`, {status: 'rejected'})).status,
    200
  )
  assert.equal((await student.get(`/api/claims/${c.body.id}/thread`)).status, 403)
  assert.equal((await mutate(finder, 'post', `/api/items/${a.body.id}/resolve`)).status, 200)
})
test('student email verification gates sign-in and tokens are one use', async () => {
  const details = {
    name: 'Verified Student',
    email: 'verified@vitstudent.ac.in',
    registration: '24BIT9100',
    password: 'StrongPassword1!'
  }
  const created = await mutate(request(app), 'post', '/api/auth/register', details)
  assert.equal(created.status, 201)
  assert.equal('token' in created.body, false)
  assert.equal(
    (
      await mutate(request(app), 'post', '/api/auth/login', {
        email: details.email,
        password: details.password
      })
    ).status,
    403
  )
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(details.email)
  assert.notEqual(u.password, details.password)
  const token = 'a'.repeat(64)
  const {createHash} = await import('node:crypto')
  db.prepare('DELETE FROM verification WHERE user_id=?').run(u.id)
  db.prepare('INSERT INTO verification VALUES(?,?,?)').run(
    createHash('sha256').update(token).digest('hex'),
    u.id,
    Date.now() + 60000
  )
  assert.equal((await mutate(request(app), 'post', '/api/auth/verify', {token})).status, 200)
  assert.equal((await mutate(request(app), 'post', '/api/auth/verify', {token})).status, 400)
  const a = request.agent(app)
  assert.equal(
    (await mutate(a, 'post', '/api/auth/login', {email: details.email, password: details.password}))
      .status,
    200
  )
  assert.equal((await a.get('/api/auth/me')).body.user.email, details.email)
  assert.equal((await mutate(a, 'post', '/api/auth/logout')).status, 200)
  assert.equal((await a.get('/api/auth/me')).body.user, null)
})

test('development permits alternate loopback ports and rejects external or missing origins', async () => {
  for (const o of ['http://localhost:5174', 'http://127.0.0.1:5173', 'http://localhost:8080'])
    assert.equal(
      (await request(app).post('/api/auth/logout').set('Origin', o).send({})).status,
      200
    )
  for (const o of ['https://evil.example', 'http://localhost.evil.example:5173', 'null'])
    assert.equal(
      (await request(app).post('/api/auth/logout').set('Origin', o).send({})).status,
      403
    )
  assert.equal((await request(app).post('/api/auth/logout').send({})).status, 403)
})
