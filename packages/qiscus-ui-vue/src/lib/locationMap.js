// Leaflet glue for share location: the only place that creates tile layers.
// Pure settings (URLs, attribution, sessions) live in ./shareLocation.js.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MAP_REFERRER_POLICY,
  PROVIDER_GOOGLE,
  getGoogleTileSession,
  mapConfigOf,
  tileLayerSpec,
} from './shareLocation';

export { L };

/** Indonesia overview, shown until the first GPS fix. */
export const INITIAL_CENTER = [-2.5, 118];
export const INITIAL_ZOOM = 4;
export const FIX_ZOOM = 17;
export const THUMBNAIL_ZOOM = 15;

/**
 * Adds the app's tile layer to `map`. Google needs a Map Tiles session first;
 * without one the map stays blank (no unofficial Google tile URLs, ever).
 * Returns a function that removes the layer and ignores a late session.
 */
export function attachLocationTiles(map, config, { onAttribution } = {}) {
  const mapConfig = mapConfigOf(config);
  let layer = null;
  let alive = true;

  const add = (spec) => {
    if (!alive || !spec) return;
    layer = L.tileLayer(spec.url, {
      attribution: spec.attribution,
      maxZoom: 19,
      maxNativeZoom: spec.maxZoom,
      referrerPolicy: MAP_REFERRER_POLICY,
    }).addTo(map);
    if (onAttribution) onAttribution(spec);
  };

  if (mapConfig.provider === PROVIDER_GOOGLE) {
    getGoogleTileSession(mapConfig.googleApiKey).then(
      session => add(tileLayerSpec(mapConfig, session)),
      () => {
        // Blank background; the pin, GPS and Send keep working. The key is
        // part of the request URL, so only the fact is logged.
        console.warn('[live chat] Google Map Tiles session failed; map shown without tiles');
      },
    );
  } else {
    add(tileLayerSpec(mapConfig));
  }

  return () => {
    alive = false;
    if (layer) map.removeLayer(layer);
    layer = null;
  };
}
