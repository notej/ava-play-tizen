import { defineConfig } from 'vite';
import { Readable } from 'node:stream';

/**
 * Dev-only helper for testing real playlists in a desktop browser.
 * Browsers block cross-origin calls to IPTV providers (CORS) and cannot send a custom User-Agent,
 * so /__proxy?url=... fetches the URL server-side. HLS playlists are rewritten so their segments
 * also go through the proxy. It is not part of the production build: on a Tizen TV the app talks to
 * the provider directly. Only loopback clients may use it.
 */
function devProxy() {
  // Loopback and private-network clients only (this Mac, or a phone / TV on the same Wi-Fi)
  const allowed = (addr = '') => {
    const ip = addr.replace(/^::ffff:/, '');
    return ip === '::1' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  };
  return {
    name: 'avaplay-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        if (!allowed(req.socket.remoteAddress)) { res.statusCode = 403; res.end('Local network only'); return; }
        const params = new URL(req.url, 'http://localhost').searchParams;
        const target = params.get('url');
        const ua = params.get('ua') || 'AvaPlay-Tizen-Dev/1.0';
        if (!target || !/^https?:\/\//i.test(target)) { res.statusCode = 400; res.end('Bad url'); return; }

        const abort = new AbortController();
        res.on('close', () => abort.abort());
        try {
          const headers = { 'User-Agent': ua };
          if (req.headers.range) headers.Range = req.headers.range;
          const upstream = await fetch(target, { headers, redirect: 'follow', signal: abort.signal });
          res.statusCode = upstream.status;
          res.setHeader('Access-Control-Allow-Origin', '*');
          const type = upstream.headers.get('content-type') || '';
          if (type) res.setHeader('Content-Type', type);

          const looksHls = /mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(upstream.url);
          if (looksHls) {
            const text = await upstream.text();
            const base = upstream.url;
            const wrap = (u) => `/__proxy?url=${encodeURIComponent(new URL(u, base).toString())}&ua=${encodeURIComponent(ua)}`;
            const out = text.split(/\r?\n/).map((line) => {
              if (!line.trim()) return line;
              if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${wrap(u)}"`);
              return wrap(line.trim());
            }).join('\n');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.end(out);
            return;
          }
          // Seeking in a film needs the byte-range headers to pass through
          for (const h of ['content-length', 'content-range', 'accept-ranges']) {
            const value = upstream.headers.get(h);
            if (value) res.setHeader(h, value);
          }
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
          if (!upstream.body) { res.end(); return; }
          Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
        } catch (err) {
          if (!res.headersSent) { res.statusCode = 502; res.end(`Proxy error: ${(err.cause && (err.cause.code || err.cause.message)) || err.message}`); } else res.destroy();
        }
      });
    }
  };
}

export default defineConfig({
  base: './', // Essential for Tizen WGT file:// protocol packaging
  plugins: [devProxy()],
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2018', // Compatibility across Tizen 4.0 (Chromium 56+ via polyfill) through Tizen 8.0
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
