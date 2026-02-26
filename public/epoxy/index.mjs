/*
 * Epoxy transport wrapper for bare-mux v2 compatibility.
 *
 * This file lives in public/ so it is NOT processed by the obfuscator.
 * It is loaded by bare-mux's SharedWorker via dynamic import().
 *
 * Issues fixed:
 * 1. bare-mux v2 sends request headers as a plain object {key: value}.
 *    epoxy-transport v3 iterates with  for (let [k,v] of headers)  which
 *    requires an iterable — plain objects are not iterable.
 *
 * 2. epoxy returns response headers as [[key, value], ...] (array of pairs).
 *    bare-mux / scramjet expect {key: [values]} (object with value arrays).
 *
 * 3. epoxy preserves original HTTP header casing (e.g. "Location").
 *    scramjet accesses headers by lowercase name (e.g. "location").
 */
import EpoxyTransport from "../epoxy-raw/index.mjs";

function toIterable(headers) {
  if (!headers) return [];
  if (typeof headers[Symbol.iterator] === "function") return headers;
  if (typeof headers.entries === "function") return headers.entries();
  return Object.entries(headers);
}

function pairsToObj(headers) {
  if (!Array.isArray(headers)) return headers;
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var entry = headers[i];
    if (!Array.isArray(entry)) return headers;
    var key = entry[0].toLowerCase();
    var val = entry[1];
    if (!obj[key]) obj[key] = [val];
    else obj[key].push(val);
  }
  return obj;
}

/*
 * HTTP/2 GOAWAY recovery:
 * Remote servers routinely send GOAWAY (NO_ERROR) to recycle connections.
 * Epoxy's WASM Hyper client surfaces this as a fatal error instead of
 * retrying on a fresh connection.  We catch this and retry once.
 */
var GOAWAY_RE = /GoAway|GOAWAY|Http2/i;
var MAX_RETRIES = 2;

class PatchedEpoxyTransport extends EpoxyTransport {
  async request(remote, method, body, headers, signal) {
    var iterableHeaders = toIterable(headers);
    for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        var res = await super.request(remote, method, body, iterableHeaders, signal);
        if (res && res.headers) res.headers = pairsToObj(res.headers);
        return res;
      } catch (err) {
        var msg = String(err && err.message || err);
        if (attempt < MAX_RETRIES && GOAWAY_RE.test(msg)) {
          /* brief pause to let the WASM transport recycle the connection */
          await new Promise(function (r) { setTimeout(r, 150 * (attempt + 1)); });
          continue;
        }
        throw err;
      }
    }
  }

  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    return super.connect(
      url,
      protocols,
      toIterable(requestHeaders),
      onopen,
      onmessage,
      onclose,
      onerror
    );
  }
}

export default PatchedEpoxyTransport;
