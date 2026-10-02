export const DEFAULT_CAMPUS_BOUNDS = {
  minLat: 12.962,
  maxLat: 12.978,
  minLng: 79.148,
  maxLng: 79.168
}

export const DEFAULT_VENUE_DETAILS = {
  SJT: {name: 'Silver Jubilee Tower (SJT)', latitude: 12.9702, longitude: 79.1568},
  TT: {name: 'Technology Tower (TT)', latitude: 12.9696, longitude: 79.1578},
  PRP: {name: 'Periyar Poly-technic Block (PRP)', latitude: 12.971, longitude: 79.1547},
  SMV: {name: 'Sir M. Visvesvaraya Block (SMV)', latitude: 12.9685, longitude: 79.1554},
  MB: {name: 'Main Building (MB)', latitude: 12.9691, longitude: 79.1562},
  GDN: {name: 'GD Naidu Block (GDN)', latitude: 12.968, longitude: 79.157},
  CDMM: {
    name: 'Center for Disaster Mitigation & Management (CDMM)',
    latitude: 12.9676,
    longitude: 79.1582
  },
  'Central Library': {
    name: 'Dr. T.P. Ganesan Central Library',
    latitude: 12.9692,
    longitude: 79.1569
  },
  Gazebo: {name: 'Gazebo Food Court', latitude: 12.9684, longitude: 79.1584},
  'Food Mall': {name: 'Food Mall', latitude: 12.9675, longitude: 79.1575},
  DC: {name: 'Darling Caves / DC Food Court', latitude: 12.967, longitude: 79.1565},
  'Sports Complex': {name: 'Outdoor & Indoor Sports Complex', latitude: 12.9715, longitude: 79.163}
}

export function schematicPoint(
  venue,
  details = DEFAULT_VENUE_DETAILS,
  bounds = DEFAULT_CAMPUS_BOUNDS
) {
  const activeDetails = details && Object.keys(details).length ? details : DEFAULT_VENUE_DETAILS
  const activeBounds = bounds && bounds.minLng != null ? bounds : DEFAULT_CAMPUS_BOUNDS
  const point = activeDetails?.[venue]
  if (!point || !activeBounds) return {x: 50, y: 50}
  const x =
    ((point.longitude - activeBounds.minLng) / (activeBounds.maxLng - activeBounds.minLng)) * 84 + 8
  const y =
    (1 - (point.latitude - activeBounds.minLat) / (activeBounds.maxLat - activeBounds.minLat)) *
      84 +
    8
  return {x, y}
}

export function venueCoords(venue, details = DEFAULT_VENUE_DETAILS) {
  const activeDetails = details && Object.keys(details).length ? details : DEFAULT_VENUE_DETAILS
  const point = activeDetails?.[venue]
  if (!point) return null
  return {latitude: point.latitude, longitude: point.longitude}
}
