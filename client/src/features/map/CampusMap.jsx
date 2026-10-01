import {useEffect, useRef, useState} from 'react';
import OfflineCampusMap from './OfflineCampusMap.jsx';
import {venueCoords} from '../../lib/campus.js';

const CAMPUS = [79.156, 12.9688];
const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const LOAD_TIMEOUT_MS = 8000;

function tokenLooksUsable() {
  return Boolean(TOKEN && TOKEN.startsWith('pk.') && !TOKEN.includes('your_token'));
}

async function mapboxTokenValid() {
  if (!tokenLooksUsable()) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${TOKEN}`,
      {signal: ctrl.signal}
    );
    return res.ok;
  } catch (err) {
    console.warn('Mapbox token check failed', err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isTouch() {
  return window.matchMedia('(pointer: coarse)').matches;
}

function waitForLoad(map) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Map load timed out after 8s')),
      LOAD_TIMEOUT_MS
    );
    map.once('load', () => {
      clearTimeout(timer);
      resolve();
    });
    map.once('error', event => {
      clearTimeout(timer);
      reject(event?.error || new Error('Map error'));
    });
  });
}

export default function CampusMap({
  mode = 'browse',
  items = [],
  location = null,
  focusLocation = null,
  selectedVenue = '',
  venueDetails = {},
  campusBounds = null,
  onLocationChange,
  onItemSelect,
  hidden = false,
  className = '',
}) {
  const canvas = useRef(null);
  const engine = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const pin = useRef(null);
  const itemsRef = useRef(items);
  const onSelectRef = useRef(onItemSelect);
  const onLocRef = useRef(onLocationChange);
  itemsRef.current = items;
  onSelectRef.current = onItemSelect;
  onLocRef.current = onLocationChange;

  const [tier, setTier] = useState('loading');
  const [notice, setNotice] = useState('');
  const [geoMessage, setGeoMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    engine.current = null;
    map.current = null;

    const start = async () => {
      if (hidden || !canvas.current) return;
      try {
        const mapboxOk = await mapboxTokenValid();
        if (cancelled) return;
        if (mapboxOk) {
          await bootVector('mapbox');
          if (!cancelled) setTier('mapbox');
          return;
        }
        await bootVector('maplibre');
        if (!cancelled) {
          setTier('maplibre');
          setNotice('Showing a keyless campus map.');
        }
      } catch (err) {
        console.warn('Vector map failed, using offline schematic', err);
        if (!cancelled) {
          teardown();
          setTier('offline');
          setNotice('Showing offline campus map');
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry, hidden]);

  async function bootVector(kind) {
    const lib =
      kind === 'mapbox'
        ? (await import('mapbox-gl')).default
        : (await import('maplibre-gl')).default;
    if (kind === 'mapbox') {
      await import('mapbox-gl/dist/mapbox-gl.css');
      lib.accessToken = TOKEN;
    } else {
      await import('maplibre-gl/dist/maplibre-gl.css');
    }

    const center = location
      ? [location.longitude, location.latitude]
      : CAMPUS;
    const instance = new lib.Map({
      container: canvas.current,
      style:
        kind === 'mapbox'
          ? 'mapbox://styles/mapbox/streets-v12'
          : 'https://tiles.openfreemap.org/styles/liberty',
      center,
      zoom: mode === 'picker' ? 16.5 : 15.4,
      attributionControl: true,
      cooperativeGestures: isTouch(),
      maxZoom: 20,
    });
    engine.current = lib;
    map.current = instance;
    instance.addControl(new lib.NavigationControl({showCompass: false}), 'top-right');

    const geolocate = new lib.GeolocateControl({
      positionOptions: {enableHighAccuracy: true, timeout: 10000},
      trackUserLocation: mode === 'browse',
      showUserHeading: mode === 'browse',
      showAccuracyCircle: true,
    });
    geolocate.on('error', () => {
      const secure = window.isSecureContext;
      setGeoMessage(
        secure
          ? 'Location is blocked or unavailable in this browser.'
          : 'Live location needs HTTPS or localhost.'
      );
    });
    geolocate.on('geolocate', position => {
      if (mode === 'picker') {
        onLocRef.current?.({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        });
      }
    });
    instance.addControl(geolocate, 'top-right');

    if (mode === 'picker') {
      instance.on('click', event =>
        onLocRef.current?.({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
        })
      );
    }

    await waitForLoad(instance);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(canvas.current);
    instance._reuniteObserver = observer;
    drawItems();
    drawPin();
  }

  function teardown() {
    markers.current.forEach(m => m.remove());
    markers.current = [];
    pin.current?.remove();
    pin.current = null;
    if (map.current?._reuniteObserver) map.current._reuniteObserver.disconnect();
    map.current?.remove();
    map.current = null;
  }

  function drawItems() {
    const instance = map.current;
    const lib = engine.current;
    if (!instance || !lib || mode !== 'browse') return;
    markers.current.forEach(m => m.remove());
    markers.current = [];
    for (const item of itemsRef.current) {
      if (item.longitude == null || item.latitude == null) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `reunite-map-pin ${item.kind}`;
      button.setAttribute(
        'aria-label',
        `${item.kind} item: ${item.title}, ${item.venue}`
      );
      button.innerHTML = '<span></span>';
      const marker = new lib.Marker({element: button, anchor: 'bottom'})
        .setLngLat([Number(item.longitude), Number(item.latitude)])
        .addTo(instance);
      button.addEventListener('click', event => {
        event.stopPropagation();
        onSelectRef.current?.(item);
      });
      markers.current.push(marker);
    }
  }

  function drawPin() {
    const instance = map.current;
    const lib = engine.current;
    if (!instance || !lib || mode !== 'picker') return;
    if (!location) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    const point = [Number(location.longitude), Number(location.latitude)];
    if (!pin.current) {
      const el = document.createElement('div');
      el.className = 'report-map-pin';
      pin.current = new lib.Marker({element: el, anchor: 'bottom', draggable: true})
        .setLngLat(point)
        .addTo(instance);
      pin.current.on('dragend', () => {
        const lngLat = pin.current.getLngLat();
        onLocRef.current?.({longitude: lngLat.lng, latitude: lngLat.lat});
      });
    } else {
      pin.current.setLngLat(point);
    }
  }

  useEffect(() => {
    if (tier === 'mapbox' || tier === 'maplibre') drawItems();
  }, [items, tier, mode]);

  useEffect(() => {
    if (tier === 'mapbox' || tier === 'maplibre') drawPin();
  }, [location, tier, mode]);

  useEffect(() => {
    if (!map.current || !focusLocation) return;
    map.current.flyTo({
      center: [Number(focusLocation.longitude), Number(focusLocation.latitude)],
      zoom: 17.4,
      duration: 800,
    });
  }, [focusLocation]);

  useEffect(() => {
    const coords = venueCoords(selectedVenue, venueDetails);
    if (!coords || !map.current) return;
    map.current.flyTo({
      center: [coords.longitude, coords.latitude],
      zoom: 17,
      duration: 700,
    });
  }, [selectedVenue, venueDetails]);

  const showOffline = tier === 'offline';

  return (
    <div
      className={`map-shell ${className}`}
      hidden={hidden}
      data-testid="map-shell"
    >
      {tier === 'loading' ? (
        <div className="map-skeleton" role="status" style={{position: 'absolute', inset: 0, zIndex: 2}}>
          Loading campus map…
        </div>
      ) : null}
      <div
        ref={canvas}
        className="map-canvas"
        style={{visibility: showOffline ? 'hidden' : 'visible'}}
        aria-label={
          mode === 'picker'
            ? 'Map. Click or drag to choose the item location.'
            : 'Campus map showing lost and found item pins.'
        }
        data-testid={showOffline ? undefined : 'campus-map'}
        data-map-tier={tier}
      />
      {showOffline ? (
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
      ) : null}
      {notice ? (
        <div className="notice" data-testid="map-notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      ) : null}
      {geoMessage ? <p className="caption">{geoMessage}</p> : null}
      {tier === 'offline' ? (
        <button className="btn btn-outline" onClick={() => setRetry(n => n + 1)}>
          Retry map
        </button>
      ) : null}
    </div>
  );
}
