// Share location in the widget (src/lib/shareLocation.js): public config,
// message payload, Google geocode parsing, map tiles, picker helpers, and the
// shipped wiring (templates, loader iframe, host pages). Same contract as the
// Flutter widget qiscus_multichannel_widget 1.5.0 (QLocation).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadSrc } = require('./helpers/esm');
const { compileTemplate, compileStyle, declarationsFor } = require('./helpers/sfc');

const loc = loadSrc('lib/shareLocation.js');

const REPO = path.resolve(__dirname, '../..');
const KEY = 'AIzaTestKey_123-abc';

function okResponse(body) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function recordingFetch(response) {
  const calls = [];
  const fn = (url, init) => {
    calls.push({ url, init });
    return typeof response === 'function' ? response(url, init) : Promise.resolve(response);
  };
  fn.calls = calls;
  return fn;
}

// ------------------------------------------------------------- Config

test('normalizeShareLocationConfig: osm / google / disabled per the public endpoint', () => {
  assert.deepStrictEqual(
    loc.normalizeShareLocationConfig({ data: { enabled: true, provider: 'osm', google_api_key: null }, status: 200 }),
    { enabled: true, provider: 'osm', googleApiKey: null },
  );
  assert.deepStrictEqual(
    loc.normalizeShareLocationConfig({ data: { enabled: true, provider: 'google', google_api_key: ` ${KEY} ` } }),
    { enabled: true, provider: 'google', googleApiKey: KEY },
  );
  assert.strictEqual(
    loc.normalizeShareLocationConfig({ data: { enabled: false, provider: 'google', google_api_key: KEY } }).enabled,
    false,
  );
});

test('normalizeShareLocationConfig: anything unexpected hides the menu', () => {
  [
    null,
    undefined,
    'nope',
    {},
    { data: null },
    { data: [] },
    { data: { enabled: 'true', provider: 'osm' } },
    { data: { enabled: 1, provider: 'osm' } },
    { data: { enabled: true, provider: 'mapbox' } },
    { data: { enabled: true } },
  ].forEach((body) => {
    assert.strictEqual(loc.normalizeShareLocationConfig(body).enabled, false, JSON.stringify(body));
  });
});

test('normalizeShareLocationConfig: google without a usable key keeps the feature on OSM', () => {
  ['', '   ', null, 'bad key!', 'a'.repeat(201), 42].forEach((key) => {
    assert.deepStrictEqual(
      loc.normalizeShareLocationConfig({ data: { enabled: true, provider: 'google', google_api_key: key } }),
      { enabled: true, provider: 'osm', googleApiKey: null },
      String(key),
    );
  });
});

test('cleanGoogleApiKey: trims and applies the contract regex/length', () => {
  assert.strictEqual(loc.cleanGoogleApiKey(` ${KEY}\n`), KEY);
  assert.strictEqual(loc.cleanGoogleApiKey('a'.repeat(200)), 'a'.repeat(200));
  assert.strictEqual(loc.cleanGoogleApiKey('a'.repeat(201)), null);
  assert.strictEqual(loc.cleanGoogleApiKey('key"><img>'), null);
  assert.strictEqual(loc.cleanGoogleApiKey('key&callback=x'), null);
});

test('mapConfigOf: OSM unless google with a key (no config = OSM, e.g. agent inbox)', () => {
  assert.deepStrictEqual(loc.mapConfigOf(null), { provider: 'osm', googleApiKey: null });
  assert.deepStrictEqual(loc.mapConfigOf({ provider: 'google', googleApiKey: null }), { provider: 'osm', googleApiKey: null });
  assert.deepStrictEqual(loc.mapConfigOf({ provider: 'google', googleApiKey: KEY }), { provider: 'google', googleApiKey: KEY });
});

test('shareLocationConfigUrl: qismo base + app code, rejects junk', () => {
  assert.strictEqual(
    loc.shareLocationConfigUrl('https://omnichannel.qiscus.com', 'abc-123'),
    'https://omnichannel.qiscus.com/api/v2/share_location_config/abc-123',
  );
  assert.strictEqual(
    loc.shareLocationConfigUrl('https://qismo.example.com/base/', 'app code/x'),
    'https://qismo.example.com/base/api/v2/share_location_config/app%20code%2Fx',
  );
  assert.strictEqual(loc.shareLocationConfigUrl('javascript:alert(1)', 'abc'), null);
  assert.strictEqual(loc.shareLocationConfigUrl('not a url', 'abc'), null);
  assert.strictEqual(loc.shareLocationConfigUrl('https://x.com', '  '), null);
  assert.strictEqual(loc.shareLocationConfigUrl(null, 'abc'), null);
});

test('secureBaseUrl: upgrades an http APP_URL on an https page only', () => {
  assert.strictEqual(loc.secureBaseUrl('http://omni.example.com', 'https:'), 'https://omni.example.com');
  assert.strictEqual(loc.secureBaseUrl('http://localhost:8000', 'http:'), 'http://localhost:8000');
  assert.strictEqual(loc.secureBaseUrl('', 'https:'), null);
  assert.strictEqual(loc.secureBaseUrl(undefined, 'https:'), null);
});

test('fetchShareLocationConfig: GET without credentials, parses the body', async () => {
  const fetchImpl = recordingFetch(okResponse({ data: { enabled: true, provider: 'osm', google_api_key: null } }));
  const config = await loc.fetchShareLocationConfig({ baseUrl: 'https://q.example.com', appCode: 'app1', fetchImpl });
  assert.deepStrictEqual(config, { enabled: true, provider: 'osm', googleApiKey: null });
  assert.strictEqual(fetchImpl.calls.length, 1);
  assert.strictEqual(fetchImpl.calls[0].url, 'https://q.example.com/api/v2/share_location_config/app1');
  assert.strictEqual(fetchImpl.calls[0].init.method, 'GET');
  assert.strictEqual(fetchImpl.calls[0].init.credentials, 'omit');
});

test('fetchShareLocationConfig: 404, network error, bad JSON and timeout all mean disabled', async () => {
  const cases = [
    recordingFetch({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    recordingFetch(() => Promise.reject(new TypeError('Failed to fetch'))),
    recordingFetch({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad')) }),
    recordingFetch(() => new Promise(() => {})),
  ];
  // eslint-disable-next-line no-restricted-syntax
  for (const fetchImpl of cases) {
    // eslint-disable-next-line no-await-in-loop
    const config = await loc.fetchShareLocationConfig({
      baseUrl: 'https://q.example.com', appCode: 'app1', fetchImpl, timeoutMs: 20,
    });
    assert.strictEqual(config.enabled, false);
  }
  const noCall = recordingFetch(okResponse({}));
  const config = await loc.fetchShareLocationConfig({ baseUrl: '', appCode: 'app1', fetchImpl: noCall });
  assert.strictEqual(config.enabled, false);
  assert.strictEqual(noCall.calls.length, 0);
});

// ------------------------------------------------------------ Payload

test('buildLocationPayload: contract shape, 6 decimals, map_url from the coordinates', () => {
  const payload = loc.buildLocationPayload({
    latitude: -6.2087634123,
    longitude: 106.845599,
    name: ' Monas ',
    address: 'Gambir, Central Jakarta',
    accuracy: 12.5,
  });
  assert.deepStrictEqual(payload, {
    latitude: -6.208763,
    longitude: 106.845599,
    name: 'Monas',
    address: 'Gambir, Central Jakarta',
    map_url: 'https://maps.google.com/?q=-6.208763,106.845599',
    accuracy: 12.5,
  });
  assert.deepStrictEqual(Object.keys(payload), ['latitude', 'longitude', 'name', 'address', 'map_url', 'accuracy']);
});

test('buildLocationPayload: OSM / manual pick -> "Location" labels and accuracy null', () => {
  const payload = loc.buildLocationPayload({ latitude: 1, longitude: 2 });
  assert.strictEqual(payload.name, 'Location');
  assert.strictEqual(payload.address, 'Location');
  assert.strictEqual(payload.accuracy, null);
  assert.strictEqual(loc.buildLocationPayload({ latitude: 1, longitude: 2, accuracy: -3 }).accuracy, null);
  assert.strictEqual(loc.buildLocationPayload({ latitude: 1, longitude: 2, accuracy: NaN }).accuracy, null);
  assert.strictEqual(loc.buildLocationPayload({ latitude: 1, longitude: 2, name: '   ' }).name, 'Location');
});

test('buildLocationPayload: no "-0" in map_url, longitude wrapped, invalid points rejected', () => {
  const zero = loc.buildLocationPayload({ latitude: -0.0000001, longitude: -0.0000004 });
  assert.strictEqual(zero.map_url, 'https://maps.google.com/?q=0,0');
  assert.strictEqual(loc.buildLocationPayload({ latitude: 0, longitude: 190 }).longitude, -170);
  assert.strictEqual(loc.buildLocationPayload({ latitude: 0, longitude: -540 }).longitude, -180);
  [
    { latitude: 91, longitude: 0 },
    { latitude: -90.5, longitude: 0 },
    { latitude: NaN, longitude: 0 },
    { latitude: 0, longitude: Infinity },
    { latitude: '', longitude: 0 },
    { latitude: null, longitude: 0 },
    {},
  ].forEach((point) => {
    assert.throws(() => loc.buildLocationPayload(point), TypeError, JSON.stringify(point));
  });
});

test('parseLocationPayload: tolerant of other channels, ignores the payload map_url', () => {
  const parsed = loc.parseLocationPayload({
    latitude: '-6.2', longitude: '106.8', name: 'X', address: 'Y', map_url: 'javascript:alert(1)',
  });
  assert.deepStrictEqual(parsed, {
    latitude: -6.2,
    longitude: 106.8,
    name: 'X',
    address: 'Y',
    accuracy: null,
    mapUrl: 'https://maps.google.com/?q=-6.2,106.8',
  });
  assert.strictEqual(loc.parseLocationPayload('{"lat":1,"lng":2}').mapUrl, 'https://maps.google.com/?q=1,2');
  assert.strictEqual(loc.parseLocationPayload({ content: { latitude: 3, longitude: 4 } }).latitude, 3);
  assert.strictEqual(loc.parseLocationPayload({ payload: { latitude: 5, longitude: 6, accuracy: '8' } }).accuracy, 8);
  [null, 'x', '{bad', {}, { latitude: 1 }, { latitude: 100, longitude: 0 }, { latitude: 0, longitude: 200 }]
    .forEach((p) => {
      assert.strictEqual(loc.parseLocationPayload(p), null, JSON.stringify(p));
    });
});

// ----------------------------------------------------------- Geocode

const GEOCODE_OK = {
  status: 'OK',
  results: [
    {
      formatted_address: 'Jl. Medan Merdeka Barat No.12, Gambir, Jakarta Pusat 10110, Indonesia',
      address_components: [
        { long_name: '12', types: ['street_number'] },
        { long_name: 'Jalan Medan Merdeka Barat', types: ['route'] },
        { long_name: 'Gambir', types: ['administrative_area_level_4', 'political'] },
      ],
    },
  ],
};

test('parseGeocodeResponse: address = formatted_address, name = most specific component', () => {
  assert.deepStrictEqual(loc.parseGeocodeResponse(GEOCODE_OK), {
    name: 'Jalan Medan Merdeka Barat',
    address: 'Jl. Medan Merdeka Barat No.12, Gambir, Jakarta Pusat 10110, Indonesia',
  });
  const poi = JSON.parse(JSON.stringify(GEOCODE_OK));
  poi.results[0].address_components.unshift({ long_name: 'Monas', types: ['point_of_interest', 'establishment'] });
  assert.strictEqual(loc.parseGeocodeResponse(poi).name, 'Monas');
  const premise = JSON.parse(JSON.stringify(GEOCODE_OK));
  premise.results[0].address_components.push({ long_name: 'Gedung A', types: ['premise'] });
  assert.strictEqual(loc.parseGeocodeResponse(premise).name, 'Gedung A');
});

test('parseGeocodeResponse: falls back to the first part of formatted_address', () => {
  const body = { status: 'OK', results: [{ formatted_address: '6PH58QMF+2X, Jakarta, Indonesia', address_components: [] }] };
  assert.deepStrictEqual(loc.parseGeocodeResponse(body), {
    name: '6PH58QMF+2X',
    address: '6PH58QMF+2X, Jakarta, Indonesia',
  });
});

test('parseGeocodeResponse: no result / error status -> null', () => {
  [
    null,
    {},
    { status: 'ZERO_RESULTS', results: [] },
    { status: 'REQUEST_DENIED', error_message: 'API key not valid', results: [] },
    { status: 'OK', results: [] },
    { status: 'OK', results: [null] },
    { status: 'OK', results: [{ formatted_address: '', address_components: [] }] },
  ].forEach((body) => {
    assert.strictEqual(loc.parseGeocodeResponse(body), null, JSON.stringify(body));
  });
});

test('reverseGeocode: contract URL, origin-only referrer, failure/timeout -> null', async () => {
  const fetchImpl = recordingFetch(okResponse(GEOCODE_OK));
  const place = await loc.reverseGeocode({ latitude: -6.175392, longitude: 106.827153, key: KEY, fetchImpl });
  assert.strictEqual(place.name, 'Jalan Medan Merdeka Barat');
  assert.strictEqual(
    fetchImpl.calls[0].url,
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=-6.175392,106.827153&key=${KEY}&language=en`,
  );
  assert.strictEqual(fetchImpl.calls[0].init.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.strictEqual(fetchImpl.calls[0].init.credentials, 'omit');

  const failing = recordingFetch(() => Promise.reject(new Error('offline')));
  assert.strictEqual(await loc.reverseGeocode({ latitude: 1, longitude: 2, key: KEY, fetchImpl: failing }), null);
  const hanging = recordingFetch(() => new Promise(() => {}));
  assert.strictEqual(
    await loc.reverseGeocode({ latitude: 1, longitude: 2, key: KEY, fetchImpl: hanging, timeoutMs: 20 }),
    null,
  );
  const noKey = recordingFetch(okResponse(GEOCODE_OK));
  assert.strictEqual(await loc.reverseGeocode({ latitude: 1, longitude: 2, key: null, fetchImpl: noKey }), null);
  assert.strictEqual(noKey.calls.length, 0);
});

// ------------------------------------------------------------- Tiles

test('tileLayerSpec: OSM URL + attribution; Google only with a Map Tiles session', () => {
  const osm = loc.tileLayerSpec(null);
  assert.strictEqual(osm.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.match(osm.attribution, /OpenStreetMap<\/a> contributors/);
  assert.match(osm.attribution, /rel="noopener noreferrer"/);

  const google = { provider: 'google', googleApiKey: KEY };
  assert.strictEqual(loc.tileLayerSpec(google, null), null);
  const spec = loc.tileLayerSpec(google, { session: 'sess/1', expiresAt: 0 }, Date.UTC(2026, 10, 13));
  assert.strictEqual(spec.url, `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess%2F1&key=${KEY}`);
  assert.match(spec.attribution, /Map data &copy;2026 Google/);
  assert.doesNotMatch(spec.url, /mt\d?\.google\.com|khms|vt\?/);
});

test('createGoogleTileSession: POST createSession with the contract body', async () => {
  const fetchImpl = recordingFetch(okResponse({ session: 'abc', expiry: '1800000000', tileWidth: 256 }));
  const session = await loc.createGoogleTileSession({ key: KEY, fetchImpl });
  assert.deepStrictEqual(session, { session: 'abc', expiresAt: 1800000000 * 1000 });
  const call = fetchImpl.calls[0];
  assert.strictEqual(call.url, `https://tile.googleapis.com/v1/createSession?key=${KEY}`);
  assert.strictEqual(call.init.method, 'POST');
  assert.deepStrictEqual(JSON.parse(call.init.body), { mapType: 'roadmap', language: 'en-US', region: 'ID' });
  assert.strictEqual(call.init.referrerPolicy, 'strict-origin-when-cross-origin');

  const denied = recordingFetch({ ok: false, status: 403, json: () => Promise.resolve({}) });
  await assert.rejects(loc.createGoogleTileSession({ key: KEY, fetchImpl: denied }));
  const empty = recordingFetch(okResponse({}));
  await assert.rejects(loc.createGoogleTileSession({ key: KEY, fetchImpl: empty }));
});

test('getGoogleTileSession: one shared session per key; failures and expiry retry', async () => {
  loc.resetGoogleTileSessions();
  const farFuture = Math.floor(Date.now() / 1000) + (14 * 24 * 3600);
  const fetchImpl = recordingFetch(okResponse({ session: 's1', expiry: String(farFuture) }));
  const [a, b] = await Promise.all([
    loc.getGoogleTileSession(KEY, { fetchImpl }),
    loc.getGoogleTileSession(KEY, { fetchImpl }),
  ]);
  assert.strictEqual(a, b);
  assert.strictEqual(fetchImpl.calls.length, 1);

  loc.resetGoogleTileSessions();
  let attempt = 0;
  const flaky = recordingFetch(() => {
    attempt += 1;
    return Promise.resolve(attempt === 1
      ? { ok: false, status: 500, json: () => Promise.resolve({}) }
      : okResponse({ session: 's2', expiry: String(farFuture) }));
  });
  await assert.rejects(loc.getGoogleTileSession(KEY, { fetchImpl: flaky }));
  assert.strictEqual((await loc.getGoogleTileSession(KEY, { fetchImpl: flaky })).session, 's2');

  loc.resetGoogleTileSessions();
  const soon = Math.floor(Date.now() / 1000) + 60; // inside the 1 h renewal margin
  const expiring = recordingFetch(okResponse({ session: 's3', expiry: String(soon) }));
  await loc.getGoogleTileSession(KEY, { fetchImpl: expiring });
  await loc.getGoogleTileSession(KEY, { fetchImpl: expiring });
  assert.strictEqual(expiring.calls.length, 2);
  loc.resetGoogleTileSessions();
});

// ------------------------------------------------------------ Picker

test('accuracyLevel: green <= 20 m, yellow <= 100 m, red beyond', () => {
  assert.strictEqual(loc.accuracyLevel(0), 'good');
  assert.strictEqual(loc.accuracyLevel(20), 'good');
  assert.strictEqual(loc.accuracyLevel(20.1), 'fair');
  assert.strictEqual(loc.accuracyLevel(100), 'fair');
  assert.strictEqual(loc.accuracyLevel(101), 'poor');
  assert.strictEqual(loc.accuracyLevel(null), null);
  assert.strictEqual(loc.accuracyLevel(-1), null);
});

test('geolocationBlocker / geolocationErrorStatus: clear reasons for every failure', () => {
  const geo = { getCurrentPosition() {} };
  assert.strictEqual(loc.geolocationBlocker({ isSecureContext: true, navigator: { geolocation: geo } }), null);
  assert.strictEqual(loc.geolocationBlocker({ isSecureContext: false, navigator: { geolocation: geo } }), 'insecure');
  assert.strictEqual(loc.geolocationBlocker({ isSecureContext: true, navigator: {} }), 'unavailable');
  assert.strictEqual(loc.geolocationErrorStatus({ code: 1 }), 'denied');
  assert.strictEqual(loc.geolocationErrorStatus({ code: 2 }), 'unavailable');
  assert.strictEqual(loc.geolocationErrorStatus({ code: 3 }), 'error');
  assert.strictEqual(loc.geolocationErrorStatus(undefined), 'error');
  ['denied', 'unavailable', 'insecure', 'error'].forEach((status) => {
    assert.match(loc.GPS_MESSAGES[status], /pick a location/);
  });
  assert.match(loc.GPS_MESSAGES.insecure, /HTTPS/);
});

// ------------------------------------------------------- Shipped wiring

test('CommentForm: Location trigger only behind canShareLocation', () => {
  const html = compileTemplate('CommentForm.vue');
  assert.match(html, /<span class="qcw-icon" v-if="canShareLocation">/);
  assert.match(html, /data-location-trigger/);
  const script = fs.readFileSync(path.join(__dirname, '../src/components/CommentForm.vue'), 'utf8');
  assert.match(script, /canShareLocation\(\) \{\n\s+if \(this\.isEmailMode\) return false;/);
  assert.match(script, /state\.config && state\.config\.enabled/);
});

test('CommentLocation: link from the coordinates, new tab without opener', () => {
  const html = compileTemplate('CommentLocation.vue');
  assert.match(html, /:href="location\.mapUrl"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /map_url/);
  const comment = compileTemplate('Comment.vue');
  assert.doesNotMatch(comment, /static-map|googleMapKey|maps\/api\/staticmap/);
  assert.strictEqual((comment.match(/<comment-location/g) || []).length, 2);
});

test('LocationPickerSheet: contract controls are present', () => {
  const html = compileTemplate('LocationPickerSheet.vue');
  assert.match(html, /Use current location/);
  assert.match(html, /Send location/);
  assert.match(html, /data-location-accuracy/);
  const script = fs.readFileSync(path.join(__dirname, '../src/components/LocationPickerSheet.vue'), 'utf8');
  assert.match(script, /enableHighAccuracy: true/);
  assert.match(script, /'Location picked manually'/);
});

test('map containers isolate Leaflet z-index from sheets, modals and the composer', () => {
  const bubble = declarationsFor(compileStyle('CommentLocation.vue'), '.qcw-location-bubble__map');
  assert.strictEqual(bubble.isolation, 'isolate');
  assert.strictEqual(bubble['z-index'], '0');
  const sheetCss = compileStyle('LocationPickerSheet.vue');
  assert.strictEqual(declarationsFor(sheetCss, '.qcw-location__map-wrap').isolation, 'isolate');
  // the GPS banner and the locate button sit above Leaflet's controls (<= 1000)
  assert.ok(Number(declarationsFor(sheetCss, '.qcw-location__banner')['z-index']) > 1000);
  assert.ok(Number(declarationsFor(sheetCss, '.qcw-location__fab')['z-index']) > 1000);
});

test('ChatWindow sends type "location" with text "Sent Location" through core.sendComment', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/components/ChatWindow.vue'), 'utf8');
  assert.match(src, /\.sendComment\(\s*topicId,\s*LOCATION_MESSAGE_TEXT,\s*uniqueId,\s*LOCATION_MESSAGE_TYPE,\s*JSON\.stringify\(payload\),\s*extras,\s*\)/);
  assert.strictEqual(loc.LOCATION_MESSAGE_TEXT, 'Sent Location');
  assert.strictEqual(loc.LOCATION_MESSAGE_TYPE, 'location');
});

test('qismo-widget: every chat iframe delegates geolocation before its src', () => {
  const app = fs.readFileSync(path.join(REPO, 'qismo-widget/src/App.svelte'), 'utf8');
  const allow = app.indexOf('widgetIframe.setAttribute("allow", "geolocation")');
  const src = app.indexOf('widgetIframe.setAttribute("src", iframeSource)');
  assert.ok(allow > -1 && allow < src, 'App.svelte qcw-iframe');
  const full = fs.readFileSync(path.join(REPO, 'qismo-widget/src/FullWidget.svelte'), 'utf8');
  const blocks = full.split('el = document.createElement("iframe");').slice(1);
  assert.strictEqual(blocks.length, 2);
  blocks.forEach((block) => {
    const a = block.indexOf('el.setAttribute("allow", "geolocation")');
    const s = block.indexOf('el.src =');
    assert.ok(a > -1 && a < s, 'FullWidget.svelte iframe');
  });
});

// Handoff port: there is no Blade here. The room page sets
// window.qiscusShareLocation itself (qismo host from ?base_url= / the stored
// session, checked by src/client/room.ts), and the Worker sends no
// Permissions-Policy, so geolocation keeps its default (self + iframe allow).
test('handoff room page: share-location base set before render, resume frame delegates geolocation', () => {
  const ROOT = path.resolve(REPO, '..');
  const room = fs.readFileSync(path.join(ROOT, 'public/live-handover-room.html'), 'utf8');
  const set = room.indexOf('window.qiscusShareLocation = { baseUrl: shareLocationBase }');
  const sdk = room.indexOf('<script src="../../../js/qiscus-sdk.');
  const render = room.indexOf('QiscusSDK.render();');
  assert.ok(sdk > -1 && set > sdk && set < render, 'set after the SDK script, before render');
  assert.match(room, /room\.apiOrigin\(resumed\)/);
  assert.match(room, /room\.persistLogin\(app_id, roomId, userData, qiscusBaseUrl, shareLocationBase\)/);
  const main = fs.readFileSync(path.join(ROOT, 'src/client/main.ts'), 'utf8');
  assert.match(main, /frame\.setAttribute\("allow", "clipboard-write; geolocation"\)/);
  ['src/worker.ts', 'src/server.ts', 'public/widget.html', 'public/live-handover-room.html'].forEach((f) => {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotMatch(text, /geolocation=\(\)/, f);
    assert.doesNotMatch(text, /Permissions-Policy/i, f);
  });
});

test('CommentReplyPreview: a replied-to location shows "Location", not the wire text', () => {
  const text = fs.readFileSync(
    path.join(REPO, 'qiscus-ui-vue/src/components/CommentReplyPreview.vue'),
    'utf8',
  );
  assert.match(text, /type === 'location'\) return 'Location'/);
});
