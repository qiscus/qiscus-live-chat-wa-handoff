<template lang="pug">
  div.qcw-location(data-location-sheet @keydown.esc="emitClose")
    div.qcw-location__overlay(@click="emitClose")
    div.qcw-location__sheet(
      role="dialog"
      aria-modal="true"
      aria-label="Share location"
      tabindex="-1")
      div.qcw-location__header
        span.qcw-location__title Share location
        button.qcw-location__close(
          type="button"
          ref="closeButton"
          aria-label="Close"
          data-location-close
          @click="emitClose")
          svg(viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" aria-hidden="true")
            path(d="M5 5l10 10M15 5L5 15")

      div.qcw-location__map-wrap
        div.qcw-location__map(ref="map" data-location-map)
        //- Fixed centre pin: its tip marks the map centre (= the selected point).
        div.qcw-location__pin(aria-hidden="true")
          svg(viewBox="0 0 24 24" width="44" height="44")
            path(:fill="accent"
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z")
        button.qcw-location__fab(
          type="button"
          aria-label="Use current location"
          title="Use current location"
          :disabled="gpsStatus === 'loading'"
          @click="useCurrentLocation")
          span.qcw-location__spinner(v-if="gpsStatus === 'loading'" :style="{ borderTopColor: accent }" aria-hidden="true")
          svg(v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true")
            path(:fill="accent"
              d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.99 8.99 0 0 0 13 3.06V1h-2v2.06A8.99 8.99 0 0 0 3.06 11H1v2h2.06A8.99 8.99 0 0 0 11 20.94V23h2v-2.06A8.99 8.99 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z")
        div.qcw-location__banner(v-if="gpsMessage" role="alert" data-location-banner)
          span.qcw-location__banner-text {{ gpsMessage }}
          button.qcw-location__banner-action(
            v-if="gpsStatus !== 'insecure' && gpsStatus !== 'unavailable'"
            type="button"
            :style="{ color: accent }"
            @click="useCurrentLocation") Try again

      div.qcw-location__footer
        div.qcw-location__accuracy(:class="'qcw-location__accuracy--' + accuracyState.level" data-location-accuracy)
          span.qcw-location__dot(aria-hidden="true")
          span {{ accuracyState.label }}
        div.qcw-location__place-title(data-location-title) {{ footerTitle }}
        div.qcw-location__place-subtitle(v-if="footerSubtitle") {{ footerSubtitle }}
        div.qcw-location__error(v-if="sendError" role="alert") {{ sendError }}
        div.qcw-location__actions
          button.qcw-location__btn.qcw-location__btn--outline(
            type="button"
            :style="{ color: accent, borderColor: accent }"
            :disabled="gpsStatus === 'loading' || sending"
            @click="useCurrentLocation") Use current location
          button.qcw-location__btn.qcw-location__btn--primary(
            type="button"
            data-location-send
            :style="{ background: accent }"
            :disabled="!hasSelection || sending"
            @click="send") {{ sending ? 'Sending…' : 'Send location' }}
</template>

<script>
import {
  attachLocationTiles,
  FIX_ZOOM,
  INITIAL_CENTER,
  INITIAL_ZOOM,
  L,
} from '../lib/locationMap';
import {
  GPS_MESSAGES,
  LOCATION_FALLBACK_LABEL,
  PROVIDER_GOOGLE,
  accuracyLevel,
  buildLocationPayload,
  formatCoordinates,
  geolocationBlocker,
  geolocationErrorStatus,
  mapConfigOf,
  reverseGeocode,
  wrapLongitude,
} from '../lib/shareLocation';

const GPS_TIMEOUT_MS = 20000;
const GEOCODE_DEBOUNCE_MS = 600;

function samePoint(a, b) {
  return !!a && !!b
    && Math.abs(a.lat - b.lat) < 1e-6
    && Math.abs(a.lng - b.lng) < 1e-6;
}

/**
 * Bottom-sheet map picker (same UX as the Flutter widget's
 * location_picker_sheet.dart): fixed centre pin, "Use current location",
 * GPS accuracy (green <= 20 m, yellow <= 100 m, red beyond) with its circle,
 * a manual pan drops the accuracy ("Location picked manually"), and
 * "Send location" emits the message payload. OSM: no address lookup;
 * Google: Geocoding API with the app's key.
 */
export default {
  name: 'LocationPickerSheet',
  props: {
    /** core.UI.shareLocation.config: { enabled, provider, googleApiKey }. */
    config: { type: Object, default: null },
    brandColor: { type: String, default: '#27B199' },
  },
  data() {
    return {
      gpsStatus: 'idle', // idle | loading | ready | denied | unavailable | insecure | error
      selected: null, // { lat, lng } under the pin
      selectedAccuracy: null,
      hasSelection: false,
      geocoding: false,
      resolvedFor: null,
      place: null, // { name, address } for resolvedFor
      sending: false,
      sendError: '',
    };
  },
  computed: {
    accent() {
      return this.brandColor || '#27B199';
    },
    isGoogle() {
      return mapConfigOf(this.config).provider === PROVIDER_GOOGLE;
    },
    gpsMessage() {
      return GPS_MESSAGES[this.gpsStatus] || '';
    },
    accuracyState() {
      if (this.gpsStatus === 'loading' && !this.hasSelection) {
        return { level: 'muted', label: 'Getting your current location…' };
      }
      if (!this.hasSelection) {
        return { level: 'muted', label: 'Move the map to pick a location' };
      }
      if (this.selectedAccuracy === null) {
        return { level: 'muted', label: 'Location picked manually' };
      }
      return {
        level: accuracyLevel(this.selectedAccuracy) || 'muted',
        label: `GPS accuracy ±${Math.round(this.selectedAccuracy)} m`,
      };
    },
    footerTitle() {
      if (!this.hasSelection) return 'No location selected';
      if (!this.isGoogle) return LOCATION_FALLBACK_LABEL;
      if (this.geocoding || !samePoint(this.resolvedFor, this.selected)) return 'Finding address…';
      return (this.place && this.place.name) || LOCATION_FALLBACK_LABEL;
    },
    footerSubtitle() {
      if (!this.hasSelection) return '';
      const coords = formatCoordinates(this.selected.lat, this.selected.lng);
      if (!this.isGoogle) return coords;
      if (this.geocoding || !samePoint(this.resolvedFor, this.selected)) return coords;
      return (this.place && this.place.address) || coords;
    },
  },
  beforeCreate() {
    this.map = null;
    this.detachTiles = null;
    this.gpsLayers = [];
    this.programmaticMove = false;
    this.resizeObserver = null;
    this.removeResizeListener = null;
    this.geocodeSeq = 0;
    this.geocodeTimer = 0;
  },
  mounted() {
    this.createMap();
    this.$nextTick(() => {
      const button = this.$refs.closeButton;
      if (button && button.focus) button.focus({ preventScroll: true });
    });
    this.useCurrentLocation();
  },
  beforeDestroy() {
    clearTimeout(this.geocodeTimer);
    this.geocodeSeq += 1;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.removeResizeListener) this.removeResizeListener();
    if (this.detachTiles) this.detachTiles();
    if (this.map) this.map.remove();
    this.map = null;
  },
  watch: {
    config() {
      if (!this.map) return;
      if (this.detachTiles) this.detachTiles();
      this.detachTiles = attachLocationTiles(this.map, this.config);
    },
  },
  methods: {
    emitClose() {
      this.$emit('close');
    },
    createMap() {
      const map = L.map(this.$refs.map, {
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 2,
        maxZoom: 19,
        // Zooming keeps the point under the pin; only a pan picks a new one.
        scrollWheelZoom: 'center',
        doubleClickZoom: 'center',
        touchZoom: 'center',
        zoomControl: false,
        attributionControl: false,
      });
      // Bottom-left, under the zoom buttons: the top edge is for the GPS banner.
      L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      this.map = map;
      this.detachTiles = attachLocationTiles(map, this.config);
      map.on('moveend', this.onMoveEnd);
      // The map's height changes with the footer (address lines, errors) and
      // the panel; Leaflet must know, or the point under the pin drifts from
      // the selection. invalidateSize() keeps the centre where it was.
      const remeasure = () => {
        if (this.map) this.silently(() => this.map.invalidateSize());
      };
      if (typeof window.ResizeObserver === 'function') {
        this.resizeObserver = new window.ResizeObserver(remeasure);
        this.resizeObserver.observe(this.$refs.map);
      } else {
        window.addEventListener('resize', remeasure);
        this.removeResizeListener = () => window.removeEventListener('resize', remeasure);
      }
      // The sheet animates in; measure again once it has its final size.
      setTimeout(remeasure, 250);
    },
    /** Runs a programmatic view change without treating it as a manual pick. */
    silently(change) {
      // Without animation Leaflet fires moveend synchronously, inside change().
      this.programmaticMove = true;
      try {
        change();
      } finally {
        this.programmaticMove = false;
      }
    },
    moveMap(point) {
      if (!this.map) return;
      this.silently(() => this.map.setView([point.lat, point.lng], FIX_ZOOM, { animate: false }));
    },
    onMoveEnd() {
      if (this.programmaticMove || !this.map) return;
      const center = this.map.getCenter();
      const point = { lat: center.lat, lng: wrapLongitude(center.lng) };
      if (samePoint(point, this.selected)) return; // zoom around the pin
      this.selected = point;
      this.selectedAccuracy = null; // picked manually
      this.hasSelection = true;
      this.sendError = '';
      this.scheduleGeocode(point, false);
    },
    // ------------------------------------------------------------- GPS
    useCurrentLocation() {
      if (this.gpsStatus === 'loading') return;
      const blocker = geolocationBlocker(window);
      if (blocker) {
        this.gpsStatus = blocker;
        return;
      }
      this.gpsStatus = 'loading';
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!this.map) return;
          const { latitude, longitude, accuracy } = position.coords;
          const point = { lat: latitude, lng: longitude };
          this.gpsStatus = 'ready';
          this.selected = point;
          this.selectedAccuracy = Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null;
          this.hasSelection = true;
          this.sendError = '';
          this.drawGps(point, this.selectedAccuracy);
          this.moveMap(point);
          this.scheduleGeocode(point, true);
        },
        (error) => {
          if (!this.map) return;
          this.gpsStatus = geolocationErrorStatus(error);
        },
        { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
      );
    },
    drawGps(point, accuracy) {
      this.gpsLayers.forEach(layer => this.map.removeLayer(layer));
      this.gpsLayers = [];
      if (accuracy) {
        this.gpsLayers.push(L.circle([point.lat, point.lng], {
          radius: accuracy,
          color: '#2196F3',
          opacity: 0.6,
          weight: 1,
          fillColor: '#2196F3',
          fillOpacity: 0.2,
          interactive: false,
        }).addTo(this.map));
      }
      this.gpsLayers.push(L.circleMarker([point.lat, point.lng], {
        radius: 7,
        color: '#FFFFFF',
        weight: 3,
        fillColor: '#2196F3',
        fillOpacity: 1,
        interactive: false,
      }).addTo(this.map));
    },
    // ------------------------------------------------------- Geocoding
    scheduleGeocode(point, immediate) {
      if (!this.isGoogle) return;
      clearTimeout(this.geocodeTimer);
      this.geocoding = true;
      if (immediate) {
        this.reverseGeocode(point);
      } else {
        this.geocodeTimer = setTimeout(() => this.reverseGeocode(point), GEOCODE_DEBOUNCE_MS);
      }
    },
    lookup(point) {
      const cfg = mapConfigOf(this.config);
      return reverseGeocode({ latitude: point.lat, longitude: point.lng, key: cfg.googleApiKey });
    },
    reverseGeocode(point) {
      this.geocodeSeq += 1;
      const seq = this.geocodeSeq;
      this.geocoding = true;
      return this.lookup(point).then((place) => {
        if (seq !== this.geocodeSeq) return; // stale
        this.applyGeocode(point, place);
      });
    },
    applyGeocode(point, place) {
      this.geocoding = false;
      this.resolvedFor = point;
      this.place = place;
    },
    // ------------------------------------------------------------ Send
    send() {
      if (this.sending || !this.hasSelection) return Promise.resolve();
      const point = this.selected;
      const accuracy = this.selectedAccuracy;
      this.sending = true;
      this.sendError = '';

      let placePromise = Promise.resolve(null);
      if (this.isGoogle) {
        if (samePoint(this.resolvedFor, point) && !this.geocoding) {
          placePromise = Promise.resolve(this.place);
        } else {
          // Geocoding for this exact point has not finished yet.
          clearTimeout(this.geocodeTimer);
          this.geocodeSeq += 1;
          placePromise = this.lookup(point).then((place) => {
            this.applyGeocode(point, place);
            return place;
          });
        }
      }

      return placePromise.then((place) => {
        let payload;
        try {
          payload = buildLocationPayload({
            latitude: point.lat,
            longitude: point.lng,
            name: place && place.name,
            address: place && place.address,
            accuracy,
          });
        } catch (e) {
          this.sending = false;
          this.sendError = 'This location cannot be sent. Please pick another point.';
          return;
        }
        this.$emit('send', payload);
      });
    },
  },
};
</script>

<style lang="stylus">
.qcw-location
  position absolute
  top 0
  left 0
  right 0
  bottom 0
  z-index 20
  display flex
  flex-direction column
  justify-content flex-end

.qcw-location__overlay
  position absolute
  top 0
  left 0
  right 0
  bottom 0
  background rgba(10, 10, 10, .4)

.qcw-location__sheet
  position relative
  width 100%
  height 90%
  display flex
  flex-direction column
  overflow hidden
  background #fff
  border-radius 12px 12px 0 0
  box-shadow 0 -4px 16px rgba(0, 0, 0, .12)
  outline none
  animation qcwLocationUp .2s ease-out

.qcw-location__header
  flex-shrink 0
  display flex
  align-items center
  justify-content space-between
  padding 8px 8px 8px 16px
  border-bottom 1px solid #ececec

.qcw-location__title
  font-size 14px
  font-weight 600
  line-height 20px
  color #0a0a0a

.qcw-location__close
  flex-shrink 0
  display flex
  align-items center
  justify-content center
  width 36px
  height 36px
  padding 0
  border 0
  border-radius 50%
  background transparent
  color #565656
  cursor pointer
  &:hover
    background #f3f5f7
  &:focus-visible
    outline 2px solid #01416c

.qcw-location__map-wrap
  position relative
  // keeps Leaflet's z-index 400+ panes inside the sheet
  z-index 0
  isolation isolate
  flex 1
  min-height 160px

.qcw-location__map
  position absolute
  top 0
  left 0
  right 0
  bottom 0
  background #e5e3df
  .leaflet-control-attribution
    font-size 10px

.qcw-location__pin
  position absolute
  left 50%
  top 50%
  z-index 500
  width 44px
  height 44px
  margin-left -22px
  // the tip of the pin (bottom of the glyph) sits on the centre
  margin-top -42px
  pointer-events none
  svg
    display block
    filter drop-shadow(0 2px 2px rgba(0, 0, 0, .3))

.qcw-location__fab
  position absolute
  right 12px
  bottom 28px
  z-index 1100
  display flex
  align-items center
  justify-content center
  width 40px
  height 40px
  padding 0
  border 0
  border-radius 50%
  background #fff
  box-shadow 0 2px 6px rgba(0, 0, 0, .25)
  cursor pointer
  &:disabled
    cursor default

.qcw-location__spinner
  width 18px
  height 18px
  border 2px solid #ececec
  border-radius 50%
  animation qcwLocationSpin .8s linear infinite

.qcw-location__banner
  position absolute
  top 12px
  left 12px
  right 12px
  // above Leaflet's controls (z-index 800-1000)
  z-index 1100
  display flex
  align-items center
  gap 8px
  padding 8px 8px 8px 12px
  border-radius 8px
  background #fff
  box-shadow 0 2px 6px rgba(0, 0, 0, .2)
  font-size 13px
  line-height 18px
  color #0a0a0a

.qcw-location__banner-text
  flex 1

.qcw-location__banner-action
  flex-shrink 0
  padding 4px 8px
  border 0
  background transparent
  font-size 13px
  font-weight 600
  cursor pointer

.qcw-location__footer
  flex-shrink 0
  padding 12px 16px
  padding-bottom calc(12px + env(safe-area-inset-bottom))
  border-top 1px solid #ececec
  background #fff

.qcw-location__accuracy
  display flex
  align-items center
  gap 6px
  font-size 12px
  font-weight 600
  color #6b6b6b
  .qcw-location__dot
    width 8px
    height 8px
    border-radius 50%
    background currentColor
  &.qcw-location__accuracy--good
    color #2E7D32
  &.qcw-location__accuracy--fair
    color #B78103
  &.qcw-location__accuracy--poor
    color #C62828

.qcw-location__place-title
  margin-top 8px
  font-size 15px
  font-weight 600
  color #0a0a0a
  overflow hidden
  text-overflow ellipsis
  white-space nowrap

.qcw-location__place-subtitle
  margin-top 2px
  font-size 13px
  line-height 18px
  color #6b6b6b
  overflow hidden
  display -webkit-box
  -webkit-line-clamp 2
  -webkit-box-orient vertical

.qcw-location__error
  margin-top 6px
  font-size 12px
  color #C62828

.qcw-location__actions
  display flex
  gap 12px
  margin-top 12px

.qcw-location__btn
  flex 1
  min-height 44px
  padding 0 12px
  border-radius 22px
  font-size 14px
  font-weight 600
  cursor pointer
  &:disabled
    opacity .5
    cursor default

.qcw-location__btn--outline
  border 1px solid
  background #fff

.qcw-location__btn--primary
  border 0
  color #fff

@keyframes qcwLocationUp
  from
    transform translateY(24px)
    opacity 0
  to
    transform translateY(0)
    opacity 1

@keyframes qcwLocationSpin
  to
    transform rotate(360deg)
</style>
