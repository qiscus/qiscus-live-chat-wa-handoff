<template lang="pug">
  a.qcw-location-bubble(
    v-if="location"
    :href="location.mapUrl"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="'Location: ' + location.name + '. Open in maps'"
    data-location-bubble)
    span.qcw-location-bubble__map
      span.qcw-location-bubble__tiles(ref="map" aria-hidden="true")
      span.qcw-location-bubble__pin(aria-hidden="true")
        svg(viewBox="0 0 24 24" width="32" height="32")
          path(fill="#E53935"
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z")
      span.qcw-location-bubble__attribution(v-if="tilesShown" aria-hidden="true") {{ attribution }}
    span.qcw-location-bubble__name {{ location.name }}
    span.qcw-location-bubble__address(v-if="location.address !== location.name") {{ location.address }}
  span.qcw-location-bubble__fallback(v-else) {{ comment.message }}
</template>

<script>
import { attachLocationTiles, L, THUMBNAIL_ZOOM } from '../lib/locationMap';
import { PROVIDER_GOOGLE, mapConfigOf, parseLocationPayload } from '../lib/shareLocation';

/**
 * Location message: a small, non-interactive map of the point (tiles from the
 * app's provider; OSM when the page has no share-location config, e.g. the
 * agent inbox) plus name/address. The link is always computed from the
 * coordinates, never the payload's `map_url` (any channel can put any URL
 * there), and opens in a new tab without an opener.
 */
export default {
  name: 'CommentLocation',
  props: {
    comment: { type: Object, required: true },
    /** core.UI.shareLocation.config, or null. */
    config: { type: Object, default: null },
  },
  data() {
    // Attribution only once tiles are on the map (a failed Google session
    // leaves it blank).
    return { tilesShown: false };
  },
  computed: {
    location() {
      return parseLocationPayload(this.comment && this.comment.payload);
    },
    pointKey() {
      return this.location ? `${this.location.latitude},${this.location.longitude}` : '';
    },
    providerKey() {
      const cfg = mapConfigOf(this.config);
      return `${cfg.provider}:${cfg.googleApiKey || ''}`;
    },
    attribution() {
      return mapConfigOf(this.config).provider === PROVIDER_GOOGLE ? 'Google' : '© OpenStreetMap';
    },
  },
  beforeCreate() {
    this.map = null;
    this.detachTiles = null;
    this.observer = null;
  },
  mounted() {
    this.whenVisible(() => this.renderMap());
  },
  beforeDestroy() {
    this.destroyMap();
  },
  watch: {
    pointKey() {
      this.destroyMap();
      this.$nextTick(() => this.whenVisible(() => this.renderMap()));
    },
    providerKey() {
      if (!this.map) return;
      this.attachTiles();
    },
  },
  methods: {
    /** Long histories hold many bubbles: build a map only once it is near view. */
    whenVisible(callback) {
      const el = this.$refs.map;
      if (!el) return;
      if (typeof window.IntersectionObserver !== 'function') {
        callback();
        return;
      }
      this.observer = new window.IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.disconnect();
          callback();
        }
      }, { rootMargin: '200px' });
      this.observer.observe(el);
    },
    disconnect() {
      if (this.observer) this.observer.disconnect();
      this.observer = null;
    },
    renderMap() {
      const el = this.$refs.map;
      if (!el || !this.location || this.map) return;
      const map = L.map(el, {
        center: [this.location.latitude, this.location.longitude],
        zoom: THUMBNAIL_ZOOM,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
        inertia: false,
      });
      this.map = map;
      this.attachTiles();
    },
    attachTiles() {
      if (this.detachTiles) this.detachTiles();
      this.tilesShown = false;
      this.detachTiles = attachLocationTiles(this.map, this.config, {
        onAttribution: () => {
          this.tilesShown = true;
        },
      });
    },
    destroyMap() {
      this.disconnect();
      if (this.detachTiles) this.detachTiles();
      this.detachTiles = null;
      this.tilesShown = false;
      if (this.map) this.map.remove();
      this.map = null;
    },
  },
};
</script>

<style lang="stylus">
.qcw-location-bubble
  display flex
  flex-direction column
  width 240px
  max-width 100%
  color inherit
  text-decoration none
  cursor pointer
  &:hover,
  &:focus
    color inherit
    text-decoration none

.qcw-location-bubble__map
  position relative
  // own stacking context: Leaflet panes use z-index 400+, which would
  // otherwise paint over the picker sheet, modals and the composer
  z-index 0
  isolation isolate
  display block
  width 100%
  height 140px
  overflow hidden
  border-radius 7px
  background #e5e3df

.qcw-location-bubble__tiles
  position absolute
  top 0
  left 0
  right 0
  bottom 0
  display block
  // the thumbnail is a picture: the whole bubble is the link
  pointer-events none
  &.leaflet-container
    background #e5e3df
    cursor pointer

.qcw-location-bubble__pin
  position absolute
  left 50%
  top 50%
  z-index 500
  width 32px
  height 32px
  margin-left -16px
  margin-top -30px
  pointer-events none
  svg
    display block

.qcw-location-bubble__attribution
  position absolute
  right 0
  bottom 0
  z-index 500
  padding 1px 3px
  background rgba(255, 255, 255, .8)
  font-size 8px
  line-height 10px
  color rgba(0, 0, 0, .87)

.qcw-location-bubble__name
  display block
  margin 7px 4px 0
  font-weight 700
  overflow hidden
  text-overflow ellipsis
  display -webkit-box
  -webkit-line-clamp 2
  -webkit-box-orient vertical

.qcw-location-bubble__address
  margin 2px 4px 2px
  font-size 12px
  opacity .8
  overflow hidden
  display -webkit-box
  -webkit-line-clamp 3
  -webkit-box-orient vertical
</style>
