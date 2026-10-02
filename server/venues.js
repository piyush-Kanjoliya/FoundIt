/**
 * VIT Vellore Campus Landmark Coordinates & Checkpoint Mappings
 * All coordinates are best-estimate campus reference points (approximate and easy to edit).
 */

export const CAMPUS_BOUNDS = {
  minLat: 12.962,
  maxLat: 12.978,
  minLng: 79.148,
  maxLng: 79.168
}

// Maximum allowed distance from the venue landmark: ~600m in lat/lng (~0.0055 degrees)
export const MAX_VENUE_RADIUS_DEGREES = 0.006

export const VENUE_DETAILS = {
  // Academic Blocks
  SJT: {
    name: 'Silver Jubilee Tower (SJT)',
    latitude: 12.9702,
    longitude: 79.1568,
    category: 'academic',
    nearestCheckpoint: 'SJT Ground Floor Reception'
  },
  TT: {
    name: 'Technology Tower (TT)',
    latitude: 12.9696,
    longitude: 79.1578,
    category: 'academic',
    nearestCheckpoint: 'TT Reception'
  },
  PRP: {
    name: 'Periyar Poly-technic Block (PRP)',
    latitude: 12.971,
    longitude: 79.1547,
    category: 'academic',
    nearestCheckpoint: 'PRP Reception'
  },
  SMV: {
    name: 'Sir M. Visvesvaraya Block (SMV)',
    latitude: 12.9685,
    longitude: 79.1554,
    category: 'academic',
    nearestCheckpoint: 'TT Reception'
  },
  MB: {
    name: 'Main Building (MB)',
    latitude: 12.9691,
    longitude: 79.1562,
    category: 'academic',
    nearestCheckpoint: 'TT Reception'
  },
  GDN: {
    name: 'GD Naidu Block (GDN)',
    latitude: 12.968,
    longitude: 79.157,
    category: 'academic',
    nearestCheckpoint: 'TT Reception'
  },
  CDMM: {
    name: 'Center for Disaster Mitigation & Management (CDMM)',
    latitude: 12.9676,
    longitude: 79.1582,
    category: 'academic',
    nearestCheckpoint: 'Central Library Security Desk'
  },

  // Men's Hostels (MH-A to MH-T)
  'MH-A': {
    name: 'Men’s Hostel A Block',
    latitude: 12.966,
    longitude: 79.158,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-B': {
    name: 'Men’s Hostel B Block',
    latitude: 12.9662,
    longitude: 79.1583,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-C': {
    name: 'Men’s Hostel C Block',
    latitude: 12.9664,
    longitude: 79.1585,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-D': {
    name: 'Men’s Hostel D Block',
    latitude: 12.9665,
    longitude: 79.1588,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-E': {
    name: 'Men’s Hostel E Block',
    latitude: 12.9667,
    longitude: 79.159,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-F': {
    name: 'Men’s Hostel F Block',
    latitude: 12.9668,
    longitude: 79.1593,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-G': {
    name: 'Men’s Hostel G Block',
    latitude: 12.967,
    longitude: 79.1595,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-H': {
    name: 'Men’s Hostel H Block',
    latitude: 12.9672,
    longitude: 79.1598,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-I': {
    name: 'Men’s Hostel I Block',
    latitude: 12.9673,
    longitude: 79.16,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-J': {
    name: 'Men’s Hostel J Block',
    latitude: 12.9675,
    longitude: 79.1603,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-K': {
    name: 'Men’s Hostel K Block',
    latitude: 12.9676,
    longitude: 79.1605,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-L': {
    name: 'Men’s Hostel L Block',
    latitude: 12.9678,
    longitude: 79.1608,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-M': {
    name: 'Men’s Hostel M Block',
    latitude: 12.968,
    longitude: 79.161,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-N': {
    name: 'Men’s Hostel N Block',
    latitude: 12.9682,
    longitude: 79.1613,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-P': {
    name: 'Men’s Hostel P Block',
    latitude: 12.9684,
    longitude: 79.1615,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-Q': {
    name: 'Men’s Hostel Q Block',
    latitude: 12.9685,
    longitude: 79.1618,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-R': {
    name: 'Men’s Hostel R Block',
    latitude: 12.9687,
    longitude: 79.162,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-S': {
    name: 'Men’s Hostel S Block',
    latitude: 12.9688,
    longitude: 79.1623,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  'MH-T': {
    name: 'Men’s Hostel T Block',
    latitude: 12.969,
    longitude: 79.159,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },
  // Note: Array.from length 20 produces A-T minus O/I in standard ASCII (A..T is 20 letters)
  'MH-O': {
    name: 'Men’s Hostel O Block',
    latitude: 12.9683,
    longitude: 79.1614,
    category: 'mens_hostel',
    nearestCheckpoint: 'Men’s Hostel Security Desk'
  },

  // Ladies' Hostels (LH-A to LH-J)
  'LH-A': {
    name: 'Ladies’ Hostel A Block',
    latitude: 12.972,
    longitude: 79.1585,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-B': {
    name: 'Ladies’ Hostel B Block',
    latitude: 12.9723,
    longitude: 79.1588,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-C': {
    name: 'Ladies’ Hostel C Block',
    latitude: 12.9726,
    longitude: 79.159,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-D': {
    name: 'Ladies’ Hostel D Block',
    latitude: 12.9729,
    longitude: 79.1593,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-E': {
    name: 'Ladies’ Hostel E Block',
    latitude: 12.9732,
    longitude: 79.1596,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-F': {
    name: 'Ladies’ Hostel F Block',
    latitude: 12.9735,
    longitude: 79.1599,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-G': {
    name: 'Ladies’ Hostel G Block',
    latitude: 12.9738,
    longitude: 79.1602,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-H': {
    name: 'Ladies’ Hostel H Block',
    latitude: 12.9741,
    longitude: 79.1605,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-I': {
    name: 'Ladies’ Hostel I Block',
    latitude: 12.9744,
    longitude: 79.1608,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },
  'LH-J': {
    name: 'Ladies’ Hostel J Block',
    latitude: 12.9747,
    longitude: 79.161,
    category: 'ladies_hostel',
    nearestCheckpoint: 'Ladies’ Hostel Security Desk'
  },

  // Food Courts & Amenities
  Gazebo: {
    name: 'Gazebo Food Court',
    latitude: 12.9684,
    longitude: 79.1584,
    category: 'food',
    nearestCheckpoint: 'Central Library Security Desk'
  },
  'Food Mall': {
    name: 'Food Mall',
    latitude: 12.9675,
    longitude: 79.1575,
    category: 'food',
    nearestCheckpoint: 'Central Library Security Desk'
  },
  DC: {
    name: 'Darling Caves / DC Food Court',
    latitude: 12.967,
    longitude: 79.1565,
    category: 'food',
    nearestCheckpoint: 'SJT Ground Floor Reception'
  },
  'Central Library': {
    name: 'Dr. T.P. Ganesan Central Library',
    latitude: 12.9692,
    longitude: 79.1569,
    category: 'library',
    nearestCheckpoint: 'Central Library Security Desk'
  },
  'Sports Complex': {
    name: 'Outdoor & Indoor Sports Complex',
    latitude: 12.9715,
    longitude: 79.163,
    category: 'sports',
    nearestCheckpoint: 'Sports Complex Reception'
  }
}

/**
 * Returns default coordinates for a venue.
 */
export function getVenueCoordinates(venue) {
  const details = VENUE_DETAILS[venue]
  if (!details) return null
  return {latitude: details.latitude, longitude: details.longitude}
}

/**
 * Validates that coordinates are within the campus boundary.
 */
export function isWithinCampus(lat, lng) {
  return (
    lat >= CAMPUS_BOUNDS.minLat &&
    lat <= CAMPUS_BOUNDS.maxLat &&
    lng >= CAMPUS_BOUNDS.minLng &&
    lng <= CAMPUS_BOUNDS.maxLng
  )
}

/**
 * Validates that coordinates are within a reasonable distance of the specified venue.
 */
export function isNearVenue(venue, lat, lng) {
  const target = VENUE_DETAILS[venue]
  if (!target) return false
  const dLat = Math.abs(lat - target.latitude)
  const dLng = Math.abs(lng - target.longitude)
  return dLat <= MAX_VENUE_RADIUS_DEGREES && dLng <= MAX_VENUE_RADIUS_DEGREES
}

/**
 * Returns nearest checkpoint for a venue.
 */
export function getNearestCheckpoint(venue) {
  return VENUE_DETAILS[venue]?.nearestCheckpoint || 'SJT Ground Floor Reception'
}

/**
 * Maps a venue onto the offline schematic (percent coordinates).
 */
export function schematicPoint(venue) {
  const details = VENUE_DETAILS[venue]
  if (!details) return {x: 50, y: 50}
  const x =
    ((details.longitude - CAMPUS_BOUNDS.minLng) / (CAMPUS_BOUNDS.maxLng - CAMPUS_BOUNDS.minLng)) *
      84 +
    8
  const y =
    (1 -
      (details.latitude - CAMPUS_BOUNDS.minLat) / (CAMPUS_BOUNDS.maxLat - CAMPUS_BOUNDS.minLat)) *
      84 +
    8
  return {x, y}
}
