// Runs before page scripts. Preserve native GET/CORS behavior; do not use
// Playwright request routing, which can bypass Chromium's CORS preflight.
/** @param {any} options */
function installReadOnlyBrowser(options = {}) {
  const browser = /** @type {any} */ (globalThis);
  const telemetry = options.telemetry || [];
  const target = value => {
    try { return new URL(typeof value === 'string' || value instanceof URL ? String(value) : value?.url, browser.location.href); }
    catch { return null; }
  };
  const isTelemetry = value => {
    const url = target(value);
    return url && telemetry.some(entry => (!entry.path || url.pathname === entry.path) &&
      (entry.origin ? url.origin === entry.origin : url.hostname.endsWith(entry.hostnameSuffix)));
  };
  const report = (api, value, unavailable = false) => {
    const url = target(value);
    const record = { api, path: url?.pathname || '', unavailable };
    const emit = browser[options.reportName];
    if (typeof emit === 'function') Promise.resolve(emit(record)).catch(() => {});
  };
  const refused = (api, url, unavailable = false) => {
    report(api, url, unavailable);
    return new TypeError('Read-only verification refused ' + api);
  };
  if (typeof browser.fetch === 'function') {
    const native = browser.fetch.bind(browser);
    browser.fetch = (input, init) => {
      if (isTelemetry(input)) return Promise.resolve(new Response(null, { status: 204 }));
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      return method === 'GET' ? native(input, init) : Promise.reject(refused(method, input));
    };
  }
  if (browser.XMLHttpRequest) {
    const methods = new WeakMap(), prototype = browser.XMLHttpRequest.prototype;
    const open = prototype.open, send = prototype.send;
    prototype.open = function(method, url, ...rest) {
      methods.set(this, { method: String(method).toUpperCase(), url });
      return open.call(this, method, url, ...rest);
    };
    prototype.send = function(...args) {
      const request = methods.get(this);
      if (request && isTelemetry(request.url)) return;
      if (request && request.method !== 'GET') throw refused(request.method, request.url);
      return send.apply(this, args);
    };
  }
  if (browser.navigator?.sendBeacon) {
    browser.navigator.sendBeacon = url => {
      if (isTelemetry(url)) return true;
      report('sendBeacon', url);
      return false;
    };
  }
  // Native GET form/link navigation stays real; the typed request guard
  // below refuses their POSTs without intercepting CORS reads.
  for (const name of ['Worker', 'SharedWorker', 'WebSocket', 'WebTransport', 'RTCPeerConnection']) {
    if (typeof browser[name] === 'function') browser[name] = function(url) { throw refused(name, url, true); };
  }
}

// Intercept only browser-native request types. Routing Fetch/XHR/Script or
// Preflight would change CORS; the negative and positive CORS fixtures own it.
/** @param {any} page @param {(record: any) => void} onViolation */
async function installNativeWriteGuard(page, onViolation, telemetry = []) {
  const session = await page.context().newCDPSession(page);
  session.on('Page.windowOpen', () => onViolation({ api: 'new browser target', path: '', unavailable: true }));
  await session.send('Page.enable');
  session.on('Fetch.requestPaused', event => {
    const url = new URL(event.request.url);
    if (telemetry.some(entry => (!entry.path || url.pathname === entry.path) && (entry.origin ? url.origin === entry.origin : url.hostname.endsWith(entry.hostnameSuffix)))) {
      session.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 204, body: '' }).catch(() => onViolation({ api: 'telemetry containment', path: '', unavailable: true }));
      return;
    }
    const blocked = event.request.method !== 'GET';
    const record = { api: event.request.method, path: new URL(event.request.url).pathname, unavailable: false };
    if (blocked) onViolation(record);
    const command = blocked ? session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' })
      : session.send('Fetch.continueRequest', { requestId: event.requestId });
    command.catch(() => onViolation({ api: 'native request guard', path: '', unavailable: true }));
  });
  await session.send('Fetch.enable', { patterns: [...['Document', 'Ping', 'CSPViolationReport'].map(resourceType => ({ resourceType, requestStage: 'Request' })), ...telemetry.map(entry => ({ urlPattern: entry.urlPattern, requestStage: 'Request' }))] });
}

function probeTelemetry(origin) {
  return [
    { origin, path: '/api/portfolio-insight', urlPattern: origin + '/api/portfolio-insight*' },
    { hostnameSuffix: '', path: '/cdn-cgi/rum', urlPattern: '*://*/cdn-cgi/rum*' },
    { hostnameSuffix: '.clarity.ms', urlPattern: '*://*.clarity.ms/*' },
  ];
}

function launchReadOnlyBrowser(chromium, ...unsupported) {
  if (unsupported.length) throw new Error('Read-only proof requires the bundled headless shell; browser overrides are unavailable');
  return chromium.launch({ headless: true, args: ['--block-new-web-contents'] });
}

export { installReadOnlyBrowser, installNativeWriteGuard, probeTelemetry, launchReadOnlyBrowser };
