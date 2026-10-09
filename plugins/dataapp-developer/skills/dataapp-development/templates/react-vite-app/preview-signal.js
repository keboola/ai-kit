// Tells Keboola's app preview whether the page rendered or crashed. Injected into <head> by vite.config.ts.
// - `kai-preview-error` on the first uncaught error or rejection.
// - `kai-preview-healthy` once #root has children, re-sent until the parent acks (max ~2 min).
// - Never healthy after an error or while `__kaiPreviewCrashed` is set (the ErrorBoundary in src/main.tsx).
(function () {
  if (window.parent === window || window.__kaiNotifyError) return;
  function origin() {
    try {
      var a = window.location.ancestorOrigins;
      if (a && a.length) return a[0];
      if (document.referrer) return new URL(document.referrer).origin;
    } catch (e) {}
    return '*';
  }
  var failed = false;
  function notify(message, stack) {
    if (failed) return;
    failed = true;
    var payload = { type: 'kai-preview-error', message: message };
    if (stack) payload.stack = String(stack);
    try {
      window.parent.postMessage(payload, origin());
    } catch (e) {}
  }
  window.__kaiNotifyError = notify;
  window.addEventListener('error', function (ev) {
    notify((ev.error && ev.error.message) || ev.message || 'Unknown error', ev.error && ev.error.stack);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    notify(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
  });

  var acked = false;
  window.addEventListener('message', function (ev) {
    if (ev.source === window.parent && ev.data && ev.data.type === 'kai-preview-healthy-ack') acked = true;
  });
  function sendHealthy() {
    if (failed || window.__kaiPreviewCrashed) return;
    try {
      window.parent.postMessage({ type: 'kai-preview-healthy' }, origin());
    } catch (e) {
      console.warn('[kai-preview] healthy postMessage failed', e);
    }
  }
  function startBeacon() {
    sendHealthy();
    var attempts = 0;
    var timer = setInterval(function () {
      if (acked || attempts++ >= 120) return clearInterval(timer);
      sendHealthy();
    }, 1000);
  }
  function watchRoot() {
    var root = document.getElementById('root');
    if (!root) return;
    if (root.children.length > 0) return startBeacon();
    var observer = new MutationObserver(function () {
      if (root.children.length > 0) {
        observer.disconnect();
        startBeacon();
      }
    });
    observer.observe(root, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchRoot);
  else watchRoot();
})();
