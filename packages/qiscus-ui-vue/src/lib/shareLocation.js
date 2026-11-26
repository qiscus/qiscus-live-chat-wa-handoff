// Share location for the Live Chat widget: config, message payload, Google
// geocoding and map tile settings. No DOM and no Leaflet here, so everything
// is covered by test/share-location.test.js.
//
// Contract: workspace CONTRACT.md "Share Location" (same as the Flutter widget
// qiscus_multichannel_widget 1.5.0, lib/src/models.dart `QLocation`):
// comment type `location`, text `Sent Location`, payload
// {latitude, longitude, name, address, map_url, accuracy}.

export const LOCATION_MESSAGE_TEXT = 'Sent Location';
export const LOCATION_MESSAGE_TYPE = 'location';
/** name/address when there is no address (OSM mode, geocode failed). */
export const LOCATION_FALLBACK_LABEL = 'Location';

export const PROVIDER_OSM = 'osm';
export const PROVIDER_GOOGLE = 'google';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
export const GOOGLE_CREATE_SESSION_URL = 'https://tile.googleapis.com/v1/createSession';
export const GOOGLE_TILE_URL = 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}';
export const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
export const GOOGLE_SESSION_BODY = { mapType: 'roadmap', language: 'en-US', region: 'ID' };

/**
 * The widget pages send `Referrer-Policy: same-origin` (vhost.conf), so a
 * request to Google would carry no Referer and a key restricted by HTTP
 * referrer (which the contract asks clients to do) would be refused. Google
 * requests and map tiles therefore send the page origin, nothing more. The
 * origin is the widget iframe's (e.g. https://omnichannel.qiscus.com), not
 * the client's website. OSM's tile policy also asks for a valid Referer.
 */
export const MAP_REFERRER_POLICY = 'strict-origin-when-cross-origin';

export const GEOCODE_TIMEOUT_MS = 8000;
export const CONFIG_TIMEOUT_MS = 10000;
export const SESSION_TIMEOUT_MS = 15000;

const DISABLED_CONFIG = Object.freeze({
  enabled: false,
  provider: PROVIDER_OSM,
  googleApiKey: null,
});

// Same rule qismo-api applies to a saved key.
const GOOGLE_KEY_RE = /^[A-Za-z0-9_-]{1,200}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A Google API key as the contract allows it, else null. */
export function cleanGoogleApiKey(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return GOOGLE_KEY_RE.test(key) ? key : null;
}

/**
 * `GET /api/v2/share_location_config/{app_code}` body -> widget config.
 * Anything unexpected turns the feature off (the menu is hidden).
 * `google` without a usable key keeps the feature but falls back to OSM tiles
 * and no geocoding, so the visitor can still share a point.
 */
export function normalizeShareLocationConfig(body) {
  const data = isObject(body) && isObject(body.data) ? body.data : null;
  if (!data || data.enabled !== true) return DISABLED_CONFIG;
  const key = cleanGoogleApiKey(data.google_api_key);
  if (data.provider === PROVIDER_GOOGLE && key) {
    return { enabled: true, provider: PROVIDER_GOOGLE, googleApiKey: key };
  }
  if (data.provider !== PROVIDER_OSM && data.provider !== PROVIDER_GOOGLE) {
    return DISABLED_CONFIG;
  }
  return { enabled: true, provider: PROVIDER_OSM, googleApiKey: null };
}

/** The config a map must use: OSM unless the app runs Google with a key. */
export function mapConfigOf(config) {
  if (config && config.provider === PROVIDER_GOOGLE && cleanGoogleApiKey(config.googleApiKey)) {
    return { provider: PROVIDER_GOOGLE, googleApiKey: config.googleApiKey };
  }
  return { provider: PROVIDER_OSM, googleApiKey: null };
}

/** Public config URL, or null when the base URL / app code are unusable. */
export function shareLocationConfigUrl(baseUrl, appCode) {
  if (typeof baseUrl !== 'string' || typeof appCode !== 'string') return null;
  const code = appCode.trim();
  if (!code) return null;
  let url;
  try {
    url = new URL(baseUrl.trim());
  } catch (e) {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const base = `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  return `${base}/api/v2/share_location_config/${encodeURIComponent(code)}`;
}

/**
 * The host page injects APP_URL, which can say http:// behind the HTTPS proxy;
 * on an https page that request would be blocked as mixed content.
 */
export function secureBaseUrl(baseUrl, pageProtocol) {
  if (typeof baseUrl !== 'string') return null;
  const trimmed = baseUrl.trim();
  if (pageProtocol === 'https:' && /^http:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice(7)}`;
  }
  return trimmed || null;
}

/** Promise that rejects after `ms`, used to bound fetches. */
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).then(
    (value) => {
      clearTimeout(timer);
      return value;
    },
    (error) => {
      clearTimeout(timer);
      throw error;
    },
  );
}

function defaultFetch() {
  return typeof fetch === 'function' ? fetch : null;
}

/**
 * Loads the public config. Never rejects: any failure (network, 404, bad
 * body) resolves to the disabled config, so the Location menu stays hidden.
 */
export function fetchShareLocationConfig({ baseUrl, appCode, fetchImpl, timeoutMs } = {}) {
  const url = shareLocationConfigUrl(baseUrl, appCode);
  const doFetch = fetchImpl || defaultFetch();
  if (!url || !doFetch) return Promise.resolve(DISABLED_CONFIG);
  return withTimeout(
    doFetch(url, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } }),
    timeoutMs || CONFIG_TIMEOUT_MS,
  )
    .then((res) => {
      if (!res || !res.ok) return null;
      return res.json();
    })
    .then(body => normalizeShareLocationConfig(body))
    .catch(() => DISABLED_CONFIG);
}

// ------------------------------------------------------------- Payload

function toNumber(value) {
  let n = null;
  if (typeof value === 'number') n = value;
  if (typeof value === 'string' && value.trim() !== '') n = Number(value.trim());
  return n !== null && Number.isFinite(n) ? n : null;
}

/** 6 decimals (~11 cm), and never "-0" in map_url. */
export function roundCoordinate(value) {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

/** Longitude wrapped into -180..180 (Leaflet can pan past the antimeridian). */
export function wrapLongitude(value) {
  if (value >= -180 && value <= 180) return value;
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function labelOrFallback(value) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string') return LOCATION_FALLBACK_LABEL;
  const trimmed = text.trim();
  return trimmed || LOCATION_FALLBACK_LABEL;
}

/** Google Maps link computed from the coordinates (never the payload's). */
export function locationMapUrl(latitude, longitude) {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * Validates and normalises a picked point into the message payload.
 * Throws a TypeError for a missing/invalid latitude or longitude.
 */
export function buildLocationPayload({ latitude, longitude, name, address, accuracy } = {}) {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);
  if (lat === null || Math.abs(lat) > 90) {
    throw new TypeError('latitude must be a number within -90..90');
  }
  if (lng === null) throw new TypeError('longitude must be a number');
  const roundedLat = roundCoordinate(lat);
  const roundedLng = roundCoordinate(wrapLongitude(lng));
  const acc = toNumber(accuracy);
  return {
    latitude: roundedLat,
    longitude: roundedLng,
    name: labelOrFallback(name),
    address: labelOrFallback(address),
    map_url: locationMapUrl(roundedLat, roundedLng),
    accuracy: acc !== null && acc >= 0 ? acc : null,
  };
}

/**
 * Reads a location comment's payload, tolerating the shapes other channels
 * produce (string JSON, string numbers, lat/lng aliases, fields nested in
 * `content` / `payload`). Returns null when there is no valid point.
 * `mapUrl` is always recomputed from the coordinates.
 */
export function parseLocationPayload(payload) {
  let root = payload;
  if (typeof root === 'string') {
    try {
      root = JSON.parse(root);
    } catch (e) {
      return null;
    }
  }
  if (!isObject(root)) return null;
  const candidates = [root, root.content, root.payload];
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (isObject(c)) {
      const lat = toNumber(c.latitude !== undefined ? c.latitude : c.lat);
      const lng = toNumber(c.longitude !== undefined ? c.longitude : c.lng);
      if (lat !== null && lng !== null) {
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        const built = buildLocationPayload({
          latitude: lat,
          longitude: lng,
          name: c.name,
          address: c.address,
          accuracy: c.accuracy,
        });
        return {
          latitude: built.latitude,
          longitude: built.longitude,
          name: built.name,
          address: built.address,
          accuracy: built.accuracy,
          mapUrl: built.map_url,
        };
      }
    }
  }
  return null;
}

// ----------------------------------------------------------- Geocoding

export function reverseGeocodeUrl(latitude, longitude, key) {
  return `${GOOGLE_GEOCODE_URL}?latlng=${latitude},${longitude}&key=${encodeURIComponent(key)}&language=en`;
}

// Most specific first: a named place beats a building beats a street.
const NAME_COMPONENT_TYPES = [
  'point_of_interest',
  'establishment',
  'premise',
  'subpremise',
  'natural_feature',
  'airport',
  'park',
  'route',
  'neighborhood',
  'sublocality',
  'locality',
];

/**
 * Google Geocoding response -> { name, address }, or null when it has no
 * result. address = results[0].formatted_address; name = the most specific
 * address component, else the first part of formatted_address.
 */
export function parseGeocodeResponse(body) {
  if (!isObject(body) || body.status !== 'OK' || !Array.isArray(body.results)) return null;
  const first = body.results[0];
  if (!isObject(first)) return null;
  const formatted = typeof first.formatted_address === 'string'
    ? first.formatted_address.trim()
    : '';
  const components = Array.isArray(first.address_components)
    ? first.address_components.filter(c => isObject(c) && Array.isArray(c.types))
    : [];
  let name = '';
  for (let i = 0; i < NAME_COMPONENT_TYPES.length && !name; i += 1) {
    const type = NAME_COMPONENT_TYPES[i];
    const match = components.find(c => c.types.indexOf(type) !== -1
      && typeof c.long_name === 'string' && c.long_name.trim());
    if (match) name = match.long_name.trim();
  }
  if (!name && formatted) name = formatted.split(',')[0].trim();
  if (!name && !formatted) return null;
  return {
    name: name || LOCATION_FALLBACK_LABEL,
    address: formatted || LOCATION_FALLBACK_LABEL,
  };
}

/**
 * Reverse geocodes with the app's Google key. Resolves { name, address }, or
 * null on any failure/timeout (the caller then sends "Location").
 */
export function reverseGeocode({ latitude, longitude, key, fetchImpl, timeoutMs } = {}) {
  const doFetch = fetchImpl || defaultFetch();
  if (!key || !doFetch) return Promise.resolve(null);
  return withTimeout(
    doFetch(reverseGeocodeUrl(latitude, longitude, key), {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: MAP_REFERRER_POLICY,
    }),
    timeoutMs || GEOCODE_TIMEOUT_MS,
  )
    .then(res => (res && res.ok ? res.json() : null))
    .then(body => parseGeocodeResponse(body))
    .catch(() => null);
}

// ----------------------------------------------------- Map Tiles (Google)

/**
 * Creates a Google Map Tiles API session. Resolves { session, expiresAt }
 * (ms epoch) or rejects. The key is never logged.
 */
export function createGoogleTileSession({ key, fetchImpl, timeoutMs, now } = {}) {
  const doFetch = fetchImpl || defaultFetch();
  if (!key || !doFetch) return Promise.reject(new Error('Google map tiles need an API key'));
  const url = `${GOOGLE_CREATE_SESSION_URL}?key=${encodeURIComponent(key)}`;
  return withTimeout(
    doFetch(url, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: MAP_REFERRER_POLICY,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(GOOGLE_SESSION_BODY),
    }),
    timeoutMs || SESSION_TIMEOUT_MS,
  )
    .then((res) => {
      if (!res || !res.ok) throw new Error(`createSession failed: ${res ? res.status : 'no response'}`);
      return res.json();
    })
    .then((body) => {
      const session = isObject(body) && typeof body.session === 'string' ? body.session : '';
      if (!session) throw new Error('createSession returned no session');
      const expirySeconds = Number(body.expiry);
      const current = typeof now === 'number' ? now : Date.now();
      const expiresAt = Number.isFinite(expirySeconds) && expirySeconds > 0
        ? expirySeconds * 1000
        : current + (13 * 24 * 60 * 60 * 1000);
      return { session, expiresAt };
    });
}

/** A session is renewed one hour before Google expires it. */
export function isTileSessionExpired(session, now) {
  if (!session || !session.expiresAt) return true;
  const current = typeof now === 'number' ? now : Date.now();
  return current >= session.expiresAt - (60 * 60 * 1000);
}

const sessionCache = {};

/**
 * One Map Tiles session per key, shared by the picker and every bubble.
 * A failed attempt is not cached, so the next map tries again.
 */
export function getGoogleTileSession(key, options) {
  const cached = sessionCache[key];
  if (cached && (!cached.value || !isTileSessionExpired(cached.value))) return cached.promise;
  const entry = { value: null, promise: null };
  entry.promise = createGoogleTileSession(Object.assign({}, options, { key })).then(
    (value) => {
      entry.value = value;
      return value;
    },
    (error) => {
      if (sessionCache[key] === entry) delete sessionCache[key];
      throw error;
    },
  );
  sessionCache[key] = entry;
  return entry.promise;
}

/** For tests. */
export function resetGoogleTileSessions() {
  Object.keys(sessionCache).forEach((key) => {
    delete sessionCache[key];
  });
}

function googleAttribution(year) {
  return `Google &middot; Map data &copy;${year} Google &middot; <a href="https://www.google.com/intl/en_US/help/terms_maps/" target="_blank" rel="noopener noreferrer">Terms</a>`;
}

/**
 * Tile layer settings for a map config: { url, attribution, maxZoom } for
 * Leaflet's L.tileLayer, or null when Google has no session (blank map; the
 * pin, GPS and send keep working).
 */
export function tileLayerSpec(mapConfig, session, now) {
  const cfg = mapConfigOf(mapConfig);
  if (cfg.provider !== PROVIDER_GOOGLE) {
    return { url: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, maxZoom: 19 };
  }
  if (!session || !session.session) return null;
  const year = new Date(typeof now === 'number' ? now : Date.now()).getFullYear();
  return {
    url: `${GOOGLE_TILE_URL}?session=${encodeURIComponent(session.session)}&key=${encodeURIComponent(cfg.googleApiKey)}`,
    attribution: googleAttribution(year),
    maxZoom: 22,
  };
}

// --------------------------------------------------------------- Picker

/** Accuracy indicator: green <= 20 m, yellow <= 100 m, red beyond. */
export function accuracyLevel(accuracy) {
  const acc = toNumber(accuracy);
  if (acc === null || acc < 0) return null;
  if (acc <= 20) return 'good';
  if (acc <= 100) return 'fair';
  return 'poor';
}

/** Why "Use current location" cannot work here, or null when it can. */
export function geolocationBlocker(win) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  if (!w) return 'unavailable';
  if (w.isSecureContext === false) return 'insecure';
  if (!w.navigator || !w.navigator.geolocation) return 'unavailable';
  return null;
}

/** GeolocationPositionError.code -> picker status. */
export function geolocationErrorStatus(error) {
  const code = error && error.code;
  if (code === 1) return 'denied';
  if (code === 2) return 'unavailable';
  return 'error'; // 3 = TIMEOUT, or anything else
}

export const GPS_MESSAGES = {
  denied: 'Location permission was denied. You can still move the map to pick a location.',
  unavailable: 'Your current location is not available. You can move the map to pick a location.',
  insecure: 'Current location needs a secure (HTTPS) page. You can move the map to pick a location.',
  error: 'Could not get your current location. You can move the map to pick a location.',
};

export function formatCoordinates(latitude, longitude) {
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}
