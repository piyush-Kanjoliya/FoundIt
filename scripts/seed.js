import bcrypt from 'bcryptjs'
import {randomUUID} from 'node:crypto'
import {db, transaction} from '../server/db.js'
if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.')
const password = await bcrypt.hash('CampusDemo2026!', 12)
transaction(() => {
  for (const [name, email, registration] of [
    ['Demo Finder', 'finder@vitstudent.ac.in', '24BIT9001'],
    ['Demo Student', 'student@vitstudent.ac.in', '24BIT9002']
  ])
    db.prepare(
      'INSERT OR IGNORE INTO users(id,name,email,registration,password,verified) VALUES(?,?,?,?,?,1)'
    ).run(randomUUID(), name, email, registration, password)
  const owner = db.prepare('SELECT id FROM users WHERE email=?').get('finder@vitstudent.ac.in').id
  const sample = [
    [
      'found',
      'Casio scientific calculator',
      'A black scientific calculator was left on a desk after the afternoon class.',
      'Calculators',
      'SJT',
      'Which model is it, and what is written on the back?',
      79.1568,
      12.9702
    ],
    [
      'found',
      'A pair of wireless earbuds',
      'White earbuds in their charging case, recovered near the reading area.',
      'Earphones',
      'Central Library',
      'What brand and unique mark are on the case?',
      79.15686246,
      12.96921876
    ],
    [
      'lost',
      'Blue hostel room keys',
      'Two keys on a blue fabric keychain. Last seen while walking to the food court.',
      'Room Keys',
      'MH-T',
      'Describe the keychain and the distinguishing mark on the keys.',
      79.159,
      12.9669
    ],
    [
      'found',
      'Brown leather wallet',
      'A small brown wallet recovered near the food court. Contents kept private.',
      'Wallets',
      'Gazebo',
      'Describe two things inside the wallet.',
      79.1584,
      12.9686
    ],
    [
      'lost',
      'Student ID with green lanyard',
      'A student ID in a clear holder with a green lanyard. Please use the private check.',
      'ID Cards',
      'TT',
      'What name and branch are on the card you recovered?',
      79.1578,
      12.9696
    ],
    [
      'found',
      'Lab safety goggles',
      'Clear safety goggles in a dark pouch, found outside the lab.',
      'Lab Equipment',
      'PRP',
      'Describe the pouch and the label inside it.',
      79.1547,
      12.971
    ]
  ]
  for (const [kind, title, description, category, venue, challenge, longitude, latitude] of sample)
    if (!db.prepare('SELECT id FROM items WHERE title=?').get(title))
      db.prepare(
        'INSERT INTO items(id,owner_id,kind,title,description,category,venue,' +
          'occurred_on,challenge,latitude,longitude) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
      ).run(
        randomUUID(),
        owner,
        kind,
        title,
        description,
        category,
        venue,
        new Date().toISOString().slice(0, 10),
        challenge,
        latitude,
        longitude
      )
})
console.log(
  'Demo data ready. finder@vitstudent.ac.in / student@vitstudent.ac.in — password CampusDemo2026!'
)
db.close()
