import {schematicPoint} from '../../lib/campus.js';

export default function OfflineCampusMap({
  items = [],
  location,
  venueDetails,
  campusBounds,
  onLocationChange,
  onItemSelect,
  mode,
  selectedVenue,
}) {
  const venues = Object.keys(venueDetails || {});

  const pick = venue => {
    const details = venueDetails[venue];
    if (!details || mode !== 'picker') return;
    onLocationChange?.({
      latitude: details.latitude,
      longitude: details.longitude,
      venue,
    });
  };

  return (
    <svg
      className="schematic"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Offline schematic campus map"
      data-testid="campus-map"
      data-map-tier="offline"
    >
      <rect x="0" y="0" width="100" height="100" fill="#cfdcbd" />
      <text x="4" y="6" fontSize="3" fill="#314434">
        VIT Vellore · schematic (approximate)
      </text>
      {venues.map(venue => {
        const {x, y} = schematicPoint(venue, venueDetails, campusBounds);
        const active = selectedVenue === venue;
        return (
          <g key={venue} onClick={() => pick(venue)} style={{cursor: 'pointer'}}>
            <rect
              x={x - 4}
              y={y - 2.2}
              width="8"
              height="4.4"
              rx="0.8"
              fill={active ? '#245238' : '#f7fbf4'}
              stroke="#314434"
              strokeWidth="0.3"
            />
            <text
              x={x}
              y={y + 0.8}
              textAnchor="middle"
              fontSize="1.6"
              fill={active ? '#fff' : '#1c3f2b'}
            >
              {venue.length > 8 ? venue.slice(0, 7) : venue}
            </text>
          </g>
        );
      })}
      {items.map(item => {
        const {x, y} = schematicPoint(item.venue, venueDetails, campusBounds);
        return (
          <circle
            key={item.id}
            className="pin"
            cx={x}
            cy={y - 3}
            r="1.4"
            fill={item.kind === 'lost' ? '#b45a2a' : '#246b45'}
            onClick={() => onItemSelect?.(item)}
          >
            <title>{item.title}</title>
          </circle>
        );
      })}
      {location ? (
        <circle
          cx={
            schematicPoint(
              selectedVenue ||
                Object.keys(venueDetails || {}).find(
                  v =>
                    venueDetails[v].latitude === location.latitude &&
                    venueDetails[v].longitude === location.longitude
                ),
              venueDetails,
              campusBounds
            ).x
          }
          cy={
            schematicPoint(selectedVenue, venueDetails, campusBounds).y - 3
          }
          r="1.8"
          fill="#1d4ed8"
        />
      ) : null}
    </svg>
  );
}
