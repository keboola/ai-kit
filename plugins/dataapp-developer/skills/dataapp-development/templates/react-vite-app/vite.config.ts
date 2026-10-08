import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

/**
 * Injects the global error-handler script into every HTML page.
 *
 * - Survives the LLM rewriting index.html.
 */
function kaiPreviewErrorHandler(): Plugin {
  return {
    name: 'kai-preview-error-handler',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: [
            '(function(){',
            'if(window.__kaiNotifyError)return;',
            'function o(){try{var a=window.location.ancestorOrigins;if(a&&a.length)return a[0];if(document.referrer)return new URL(document.referrer).origin}catch(e){}return"*"}',
            'var s=false;',
            'function n(m,st){if(s)return;s=true;var p={type:"kai-preview-error",message:m};if(st)p.stack=String(st);try{window.parent.postMessage(p,o())}catch(e){}}',
            'window.__kaiNotifyError=n;',
            'window.addEventListener("error",function(e){n((e.error&&e.error.message)||e.message||"Unknown error",e.error&&e.error.stack)});',
            'window.addEventListener("unhandledrejection",function(e){var r=e.reason;n(r instanceof Error?r.message:String(r),r instanceof Error?r.stack:undefined)});',
            // Healthy beacon, re-sent until the parent acks (`kai-preview-healthy-ack`).
            // - Vetoed on every tick by an error (`s`) or `__kaiPreviewCrashed`, set by the
            //   ErrorBoundary in `src/main.tsx`.
            'var a=false;',
            'window.addEventListener("message",function(e){if(e&&e.source===window.parent&&e.data&&e.data.type==="kai-preview-healthy-ack")a=true});',
            'function y(){if(s||window.__kaiPreviewCrashed)return;try{window.parent.postMessage({type:"kai-preview-healthy"},o())}catch(e){console.warn("[kai-preview] healthy postMessage failed",e)}}',
            'function b(){y();var c=0;var iv=setInterval(function(){if(a||c++>=120){clearInterval(iv);return}y()},1000)}',
            'function h(){var root=document.getElementById("root");if(root){if(root.children.length>0){b();return}var ob=new MutationObserver(function(){if(root.children.length>0){ob.disconnect();b()}});ob.observe(root,{childList:true})}}',
            'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",h)}else{h()}',
            '})();',
          ].join(''),
        },
      ];
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    kaiPreviewErrorHandler(),
    // Keboola health-checks the container with `POST /`, which Vite answers with 404.
    command === 'serve' && {
      name: 'keboola-health-check',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/') {
            res.statusCode = 200;
            res.end('ok');
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    // Keboola's ingress hostname is opaque; accept any Host header.
    allowedHosts: true,
    // Browser reaches the dev server via the TLS ingress, so HMR must use wss.
    hmr: { clientPort: 443, protocol: 'wss', overlay: false },
    // Polling watcher survives platform-side write-and-rename file replacement.
    watch: { usePolling: true, interval: 200 },
    proxy: {
      // Express runs on 127.0.0.1:3100 in dev (see supervisord-dev/services/api.conf).
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3100',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // React and the chart stack change less often than the app, so they cache across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return 'charts';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
}));
