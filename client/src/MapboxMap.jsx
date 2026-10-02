import {useEffect, useRef, useState} from 'react'
import OfflineCampusMap from './features/map/OfflineCampusMap.jsx'
import {venueCoords} from './lib/campus.js'

const CAMPUS_CENTER = [79.156, 12.9688]
const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

function tokenLooksUsable() {
  return Boolean(TOKEN && TOKEN.startsWith('pk.') && !TOKEN.includes('your_token') && TOKEN !== '')
}

async function verifyMapboxToken() {
  if (!tokenLooksUsable()) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3500)
  try {
    const res = await fetch(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${TOKEN}`,
      {method: 'HEAD', signal: ctrl.signal}
    )
    return res.status === 200
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export default function MapboxMap({
  mode = 'browse',
  items = [],
  location = null,
  focusLocation = null,
  selectedVenue = '',
  venueDetails = {},
  campusBounds = null,
  onLocationChange,
  onItemSelect,
  className = ''
}) {
  const canvas = useRef(null)
  const map = useRef(null)
  const engine = useRef(null)
  const itemMarkers = useRef([])
  const pinMarker = useRef(null)
  const resizeObs = useRef(null)
  // Queues a focusLocation flyTo that arrived before the engine finished booting
  const pendingFocusRef = useRef(null)

  const itemsRef = useRef(items)
  const locationRef = useRef(location)
  const selectRef = useRef(onItemSelect)
  const locationChangeRef = useRef(onLocationChange)

  itemsRef.current = items
  locationRef.current = location
  selectRef.current = onItemSelect
  locationChangeRef.current = onLocationChange

  const [tier, setTier] = useState('loading') // 'mapbox' | 'maplibre' | 'offline' | 'loading'
  const [mapNotice, setMapNotice] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  // Initialize Map Engine based on Tier
  useEffect(() => {
    let cancelled = false

    const teardown = () => {
      itemMarkers.current.forEach(m => m.remove())
      itemMarkers.current = []
      pinMarker.current?.remove()
      pinMarker.current = null
      if (resizeObs.current) {
        resizeObs.current.disconnect()
        resizeObs.current = null
      }
      if (map.current) {
        try {
          map.current.remove()
        } catch {}
        map.current = null
      }
      engine.current = null
    }

    const boot = async () => {
      if (!canvas.current) return
      teardown()
      setTier('loading')

      // Step 1: Check if Mapbox GL token is valid
      const hasMapbox = await verifyMapboxToken()
      if (cancelled) return

      if (hasMapbox) {
        try {
          await initMapbox()
          if (!cancelled) {
            setTier('mapbox')
            setMapNotice('Tier 1: Mapbox Vector Engine')
            drainPendingFocus()
            return
          }
        } catch (err) {
          console.warn('Mapbox initialization failed, falling back to MapLibre', err)
        }
      }

      // Step 2: Fall back to MapLibre GL with keyless tiles
      if (cancelled) return
      try {
        await initMapLibre()
        if (!cancelled) {
          setTier('maplibre')
          setMapNotice('Tier 2: Keyless Vector Map (OpenFreeMap)')
          drainPendingFocus()
          return
        }
      } catch (err) {
        console.warn('MapLibre initialization failed, falling back to offline schematic', err)
      }

      // Step 3: Offline Schematic SVG
      if (!cancelled) {
        teardown()
        setTier('offline')
        setMapNotice('Tier 3: Offline Campus Schematic')
      }
    }

    boot()

    return () => {
      cancelled = true
      teardown()
    }
  }, [retryCount, mode])

  // Helper: Boot Mapbox GL
  async function initMapbox() {
    const mapboxgl = (await import('mapbox-gl')).default
    await import('mapbox-gl/dist/mapbox-gl.css')
    mapboxgl.accessToken = TOKEN

    const initialCenter = locationRef.current
      ? [Number(locationRef.current.longitude), Number(locationRef.current.latitude)]
      : CAMPUS_CENTER

    const instance = new mapboxgl.Map({
      container: canvas.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: mode === 'picker' ? 17 : 15.6,
      attributionControl: true,
      cooperativeGestures: true,
      maxZoom: 20
    })

    engine.current = mapboxgl
    map.current = instance
    setupMapControlsAndEvents(instance, mapboxgl)
    await waitForMapReady(instance)
  }

  // Helper: Boot MapLibre GL (OpenFreeMap keyless tiles)
  async function initMapLibre() {
    const maplibregl = (await import('maplibre-gl')).default
    await import('maplibre-gl/dist/maplibre-gl.css')

    const initialCenter = locationRef.current
      ? [Number(locationRef.current.longitude), Number(locationRef.current.latitude)]
      : CAMPUS_CENTER

    const instance = new maplibregl.Map({
      container: canvas.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: initialCenter,
      zoom: mode === 'picker' ? 16.8 : 15.5,
      attributionControl: true,
      cooperativeGestures: true,
      maxZoom: 20
    })

    engine.current = maplibregl
    map.current = instance
    setupMapControlsAndEvents(instance, maplibregl)
    await waitForMapReady(instance)
  }

  // Common Map controls, events, and resize handling
  function setupMapControlsAndEvents(instance, lib) {
    instance.addControl(new lib.NavigationControl({showCompass: false}), 'top-right')

    const geolocate = new lib.GeolocateControl({
      positionOptions: {enableHighAccuracy: true, timeout: 10000, maximumAge: 5000},
      trackUserLocation: mode === 'browse',
      showUserHeading: mode === 'browse',
      showAccuracyCircle: true
    })

    geolocate.on('geolocate', position => {
      if (mode === 'picker') {
        const next = {longitude: position.coords.longitude, latitude: position.coords.latitude}
        locationChangeRef.current?.(next)
        instance.flyTo({center: [next.longitude, next.latitude], zoom: 18, duration: 700})
      }
    })

    instance.addControl(geolocate, 'top-right')

    if (mode === 'picker') {
      instance.on('click', event => {
        locationChangeRef.current?.({longitude: event.lngLat.lng, latitude: event.lngLat.lat})
      })
    }

    if (canvas.current) {
      resizeObs.current = new ResizeObserver(() => instance.resize())
      resizeObs.current.observe(canvas.current)
    }
  }

  function waitForMapReady(instance) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 7000)
      instance.once('load', () => {
        clearTimeout(timeout)
        resolve()
      })
      instance.once('error', event => {
        clearTimeout(timeout)
        const status = event?.error?.status
        if (status === 401 || status === 403) {
          reject(new Error(`Unauthorized map style: HTTP ${status}`))
        } else {
          resolve()
        }
      })
    })
  }

  // Apply any focusLocation that arrived before the engine was ready
  function drainPendingFocus() {
    if (!pendingFocusRef.current || !map.current) return
    const {latitude, longitude} = pendingFocusRef.current
    pendingFocusRef.current = null
    try {
      map.current.flyTo({
        center: [Number(longitude), Number(latitude)],
        zoom: 17.5,
        duration: 850
      })
    } catch {
      // map may not be fully ready yet — silently skip
    }
  }

  // Draw items for browse mode
  const drawItems = () => {
    const instance = map.current
    const lib = engine.current
    if (!instance || !lib || mode !== 'browse') return

    itemMarkers.current.forEach(m => m.remove())
    itemMarkers.current = []

    for (const item of itemsRef.current) {
      if (
        item.longitude == null ||
        item.latitude == null ||
        !Number.isFinite(Number(item.longitude)) ||
        !Number.isFinite(Number(item.latitude))
      )
        continue

      const button = document.createElement('button')
      button.type = 'button'
      button.className = `reunite-map-pin ${item.kind}`
      button.setAttribute('aria-label', `${item.kind} item: ${item.title}, ${item.venue}`)
      button.innerHTML = '<span></span>'

      const popupNode = document.createElement('div')
      popupNode.className = 'map-popup'
      const type = document.createElement('small')
      type.textContent = item.kind === 'lost' ? 'LOST ITEM' : 'FOUND ITEM'
      const title = document.createElement('strong')
      title.textContent = item.title
      const venue = document.createElement('span')
      venue.textContent = item.venue
      popupNode.append(type, title, venue)

      const popup = new lib.Popup({
        offset: 16,
        closeButton: false,
        maxWidth: '240px'
      }).setDOMContent(popupNode)

      const marker = new lib.Marker({element: button, anchor: 'bottom'})
        .setLngLat([Number(item.longitude), Number(item.latitude)])
        .setPopup(popup)
        .addTo(instance)

      button.addEventListener('click', event => {
        event.stopPropagation()
        selectRef.current?.(item)
      })

      itemMarkers.current.push(marker)
    }
  }

  // Draw picker pin for picker mode
  const drawPin = () => {
    const instance = map.current
    const lib = engine.current
    if (!instance || !lib || mode !== 'picker') return

    if (!location) {
      pinMarker.current?.remove()
      pinMarker.current = null
      return
    }

    const point = [Number(location.longitude), Number(location.latitude)]

    if (!pinMarker.current) {
      const element = document.createElement('div')
      element.className = 'report-map-pin'
      element.setAttribute('aria-hidden', 'true')
      pinMarker.current = new lib.Marker({element, anchor: 'bottom', draggable: true})
        .setLngLat(point)
        .addTo(instance)

      pinMarker.current.on('dragend', () => {
        const lngLat = pinMarker.current.getLngLat()
        locationChangeRef.current?.({longitude: lngLat.lng, latitude: lngLat.lat})
      })
    } else {
      pinMarker.current.setLngLat(point)
    }
  }

  // Sync pins on update
  useEffect(() => {
    if (tier === 'mapbox' || tier === 'maplibre') {
      const instance = map.current
      if (instance?.isStyleLoaded()) drawItems()
      else instance?.once('load', drawItems)
    }
  }, [items, tier, mode])

  useEffect(() => {
    if (tier === 'mapbox' || tier === 'maplibre') {
      const instance = map.current
      if (instance?.isStyleLoaded()) drawPin()
      else instance?.once('load', drawPin)
    }
  }, [location, tier, mode])

  // Handle focusLocation flyTo — queue it if the engine isn't ready yet
  useEffect(() => {
    if (!focusLocation) return
    if (map.current) {
      try {
        map.current.flyTo({
          center: [Number(focusLocation.longitude), Number(focusLocation.latitude)],
          zoom: 17.5,
          duration: 850
        })
      } catch {
        // map was destroyed mid-flight; store for next boot
        pendingFocusRef.current = focusLocation
      }
    } else {
      // Engine still booting — store for drainPendingFocus()
      pendingFocusRef.current = focusLocation
    }
  }, [focusLocation])

  // Handle selectedVenue flyTo
  useEffect(() => {
    if (!selectedVenue || !map.current) return
    const coords = venueCoords(selectedVenue, venueDetails)
    if (!coords) return
    map.current.flyTo({
      center: [coords.longitude, coords.latitude],
      zoom: 17,
      duration: 700
    })
  }, [selectedVenue, venueDetails])

  const showOffline = tier === 'offline'

  return (
    <div
      className={`map-shell ${className}`}
      data-testid="map-shell"
      style={{position: 'relative', width: '100%', height: '100%'}}
    >
      {tier === 'loading' && (
        <div
          className="map-fallback"
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span>Loading campus map…</span>
        </div>
      )}

      <div
        ref={canvas}
        className="map-canvas"
        style={{
          width: '100%',
          height: '100%',
          visibility: showOffline ? 'hidden' : 'visible'
        }}
        aria-label={
          mode === 'picker'
            ? 'Map. Click or drag to choose the item location.'
            : 'Campus map showing lost and found item pins.'
        }
      />

      {showOffline && (
        <OfflineCampusMap
          items={items}
          location={location}
          venueDetails={venueDetails}
          campusBounds={campusBounds}
          onLocationChange={onLocationChange}
          onItemSelect={onItemSelect}
          mode={mode}
          selectedVenue={selectedVenue}
        />
      )}

      {/* Tier indicator chip */}
      {tier !== 'loading' && (
        <div
          className="map-tier-chip"
          style={{
            position: 'absolute',
            top: 14,
            right: 50,
            zIndex: 4,
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.4px',
            padding: '5px 10px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            color: '#2a5a3a',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 4px 12px rgba(20, 45, 30, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          title={mapNotice}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background:
                tier === 'mapbox' ? '#2f855a' : tier === 'maplibre' ? '#3182ce' : '#d69e2e'
            }}
          />
          {tier === 'mapbox' ? 'Mapbox' : tier === 'maplibre' ? 'Keyless Vector' : 'Schematic'}
          {tier === 'offline' && (
            <button
              type="button"
              onClick={() => setRetryCount(c => c + 1)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0 2px',
                color: '#2a5a3a',
                fontWeight: 700
              }}
            >
              ↻
            </button>
          )}
        </div>
      )}
    </div>
  )
}
