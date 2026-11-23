/** Deliberate Meta conversion events. Never forward form fields or quiz answers. */
(function () {
  'use strict';
  var local = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) !== -1;
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  var product = { content_ids: ['lndb-book'], content_type: 'product', content_name: 'Los Nombres del Bosque' };
  var pendingKey = 'lndb-meta-checkout';

  // What was actually bought: [{ sku, qty }] → Meta contents. The book keeps its original id
  // so its history in Meta continues. Anything malformed falls back to the book.
  function describe(items, quantity) {
    var ok = Array.isArray(items) && items.length && items.every(function (item) {
      return item && /^[a-z0-9-]{1,40}$/.test(item.sku) && Number.isInteger(item.qty) && item.qty > 0;
    });
    if (!ok) return Object.assign({}, product, { num_items: quantity || 1 });
    var contents = items.map(function (item) {
      return { id: item.sku === 'libro' ? 'lndb-book' : 'lndb-' + item.sku, quantity: item.qty };
    });
    return {
      content_ids: contents.map(function (c) { return c.id; }), contents: contents, content_type: 'product',
      num_items: contents.reduce(function (sum, c) { return sum + c.quantity; }, 0)
    };
  }
  var sentInPage = {};

  function emit(method, name, params, eventId) {
    try {
      if (local || typeof window.fbq !== 'function') return false;
      window.fbq(method, name, params || {}, eventId ? { eventID: eventId } : {});
      return true;
    } catch (_) { return false; }
  }

  window.lndbMetaTrack = function (name, props) {
    props = props || {};
    if (props.type === 'test') return;
    if (name === 'Checkout Opened') {
      emit('track', 'InitiateCheckout', describe(props.items, props.quantity));
    } else if (name === 'Add To Cart') {
      var added = describe([{ sku: props.type, qty: 1 }]);
      if (Number.isFinite(props.amount) && props.amount > 0) { added.value = props.amount; added.currency = 'COP'; }
      emit('track', 'AddToCart', added);
    } else if (name === 'Email Signup' || name === 'Newsletter Signup') {
      // Only existing successful subscription hooks call this event.
      emit('track', 'Lead', { content_name: 'Email signup', signup_source: props.group || 'newsletter' });
    } else if (name === 'Quiz Completed') {
      emit('trackCustom', 'QuizCompleted');
    } else if (name === 'Guide Download Click') {
      emit('trackCustom', 'GuideDownload', { content_name: 'Mango drawing guide', action: 'download_click' });
    }
  };

  window.lndbRememberCheckout = function (data) {
    try {
      sessionStorage.removeItem(pendingKey);
      if (data.analyticsReceipt) sessionStorage.setItem(pendingKey, JSON.stringify({ receipt: data.analyticsReceipt, reference: data.reference }));
    } catch (_) { /* Storage restrictions must not interrupt payment. */ }
  };

  window.lndbRememberTransaction = function (id) {
    try {
      var pending = JSON.parse(sessionStorage.getItem(pendingKey));
      if (pending && typeof id === 'string') {
        pending.transactionId = id;
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      }
    } catch (_) {}
  };

  function trackVerifiedPurchase(result) {
    if (!result || !result.verified || !/^purchase-[a-f0-9]{64}$/.test(result.eventId) ||
        !Number.isFinite(result.value) || result.value <= 0 || result.currency !== 'COP') return;
    var sent = [];
    try { sent = JSON.parse(localStorage.getItem('lndb-meta-purchases') || '[]'); } catch (_) {}
    if (!Array.isArray(sent)) sent = [];
    if (sentInPage[result.eventId] || sent.indexOf(result.eventId) !== -1) return;
    if (emit('track', 'Purchase', Object.assign(describe(result.items, result.quantity), {
      value: result.value, currency: result.currency
    }), result.eventId)) {
      sentInPage[result.eventId] = true;
      try { localStorage.setItem('lndb-meta-purchases', JSON.stringify(sent.concat(result.eventId).slice(-100))); } catch (_) {}
    }
  }

  async function verifyPurchase(attempt) {
    if (local) return;
    try {
      var pending = JSON.parse(sessionStorage.getItem(pendingKey));
      var transactionId = new URLSearchParams(location.search).get('id') || (pending && pending.transactionId);
      if (!pending || !transactionId) return;
      var response = await fetch('/api/purchase-event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: transactionId, receipt: pending.receipt })
      });
      if (!response.ok) {
        if (response.status >= 500 && attempt < 5) setTimeout(function () { verifyPurchase(attempt + 1); }, 5000);
        return;
      }
      var result = await response.json();
      if (result.verified) trackVerifiedPurchase(result);
      else if (result.pending && attempt < 5) setTimeout(function () { verifyPurchase(attempt + 1); }, 5000);
    } catch (_) { /* Verification and tracking never block the confirmation page. */ }
  }

  if (path === '/productos') emit('track', 'ViewContent', product);
  if (path === '/exito') verifyPurchase(0);
})();
