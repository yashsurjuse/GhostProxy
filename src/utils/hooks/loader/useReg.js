import { useEffect } from 'react';
import { BareMuxConnection } from '@mercuryworkshop/bare-mux';
import { useOptions } from '/src/utils/optionsContext';
import { fetchW as returnWServer } from './findWisp';
import store from './useLoaderStore';

export default function useReg() {
  const { options } = useOptions();
  const ws = `${location.protocol == 'http:' ? 'ws:' : 'wss:'}//${location.host}/wisp/`;
  const sws = [{ path: '/uv/ghost-sw.js', scope: '/uv/' }, { path: '/s_sw.js', scope: '/scramjet/' }];
  const setWispStatus = store((s) => s.setWispStatus);

  useEffect(() => {
    const init = async () => {
      if (!window.scr) {
        const script = document.createElement('script');
        script.src = '/scram/scramjet.all.js';
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const { ScramjetController } = $scramjetLoadController();

      window.scr = new ScramjetController({
        files: {
          wasm: '/scram/scramjet.wasm.wasm',
          all: '/scram/scramjet.all.js',
          sync: '/scram/scramjet.sync.js',
        },
        flags: { rewriterLogs: false, scramitize: false, cleanErrors: true, sourcemaps: true },
      });

      window.scr.init();

      for (const sw of sws) {
        try {
          await navigator.serviceWorker.register(
            sw.path,
            sw.scope ? { scope: sw.scope } : undefined,
          );
        } catch (err) {
          console.warn(`SW reg err (${sw.path}):`, err);
        }
      }

      const connection = new BareMuxConnection('/baremux/worker.js');
      setWispStatus('init');
      let socket = null;
      try {
        socket = await returnWServer();
      } catch (e) {
        socket = null;
      }
      !socket ? setWispStatus(false) : setWispStatus(true);

      const buildRemoteWisp = () => {
        if ((options.proxyRouting || 'direct') !== 'remote') return null;
        const raw = String(options.remoteProxyServer || '').trim();
        if (!raw) return null;

        try {
          const normalized = raw.startsWith('http://') || raw.startsWith('https://')
            ? raw
            : `https://${raw}`;
          const remoteOrigin = new URL(normalized).origin;
          const remoteProtocol = remoteOrigin.startsWith('https://') ? 'wss://' : 'ws://';
          const remoteHost = remoteOrigin.replace(/^https?:\/\//, '');
          return `${remoteProtocol}${remoteHost}/wisp/`;
        } catch {
          return null;
        }
      };

      const remoteWisp = buildRemoteWisp();
      const wispUrl =
        options.wServer != null && options.wServer !== ''
          ? options.wServer
          : remoteWisp || socket || ws;

      window.__ghostActiveWisp = wispUrl;
      await connection.setTransport('/libcurl/index.mjs', [{ wisp: wispUrl }]);
    };

    init();
  }, [options.wServer, options.proxyRouting, options.remoteProxyServer]);
}
