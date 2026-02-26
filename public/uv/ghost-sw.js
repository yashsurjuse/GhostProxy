/*global UVServiceWorker,__uv$config*/
/*
 * Ghost Proxy – UV service-worker.
 * Custom wrapper around UV's stock sw with:
 *  - skipWaiting / clients.claim for instant activation
 *  - Graceful fallback for non-UV cross-origin requests (avoids CORS errors)
 */
importScripts('uv.bundle.js');
importScripts('uv.config.js');
importScripts(__uv$config.sw || 'uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function handleRequest(event) {
  if (uv.route(event)) {
    return await uv.fetch(event);
  }
  // Only fetch same-origin or relative requests directly.
  // Cross-origin requests that aren't UV-routed should not be
  // intercepted — let the browser handle them natively.
  const url = new URL(event.request.url);
  if (url.origin === location.origin) {
    return await fetch(event.request);
  }
  // For cross-origin non-UV requests, return a transparent fetch
  // with mode/credentials that won't trigger CORS failures.
  return await fetch(event.request.url, {
    method: event.request.method,
    headers: event.request.headers,
    mode: 'no-cors',
    credentials: 'omit',
  });
}

self.addEventListener('fetch', (event) => {
  // Let Ghost AI API requests pass through to the browser directly
  // so CORS works properly and the response is not opaque.
  const url = new URL(event.request.url);
  if (url.hostname === 'api.edisonlearningcenter.me') return;

  event.respondWith(handleRequest(event));
});
