import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const previewSignal = readFileSync(new URL('./preview-signal.js', import.meta.url), 'utf8');

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'keboola-preview-signal',
      transformIndexHtml: () => [{ tag: 'script', injectTo: 'head-prepend', children: previewSignal }],
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    // Keboola's ingress hostname is opaque; accept any Host header.
    allowedHosts: true,
    // The browser reaches the dev server through the TLS ingress, so HMR uses wss on 443.
    hmr: { clientPort: 443, protocol: 'wss', overlay: false },
    // Polling survives the platform replacing files by write-and-rename.
    watch: { usePolling: true, interval: 200 },
    proxy: {
      '/api': {
        // Express under `tsx watch` (supervisord-dev/services/api.conf); the Python overlay sets 8050.
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3100',
        // While the API restarts, answer 503 JSON — the client retries it (src/lib/api.ts).
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (!('writeHead' in res) || res.headersSent) return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API is restarting' }));
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist/client',
    rolldownOptions: {
      output: {
        // React and charts change less often than the app, so they stay cached across deploys.
        advancedChunks: {
          groups: [
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory-vendor)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
