/** Shared Plausible events. Only bounded, non-personal properties belong here. */
(function () {
  'use strict';

  window.plausible = window.plausible || function () {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };
  window.plausible.init = window.plausible.init || function (options) {
    window.plausible.o = options || {};
  };

  var allowed = ['page', 'source', 'placement', 'type', 'action', 'destination',
    'asset', 'format', 'tree', 'group', 'step', 'reason', 'status', 'quantity',
    'discount', 'amount', 'currency', 'payment_method', 'member_count', 'progress',
    'question', 'answer', 'method', 'outcome', 'entry'];

  function pagePath() {
    var path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    return path === '/index' ? '/' : path;
  }

  window.lndbTrack = function (eventName, options) {
    try {
      var path = pagePath();
      var props = {
        page: path,
        source: path === '/' ? 'homepage' : path.indexOf('/arboles/') === 0 ? 'tree' : path.slice(1)
      };
      var provided = options && options.props || {};
      allowed.forEach(function (key) {
        var value = provided[key];
        if (typeof value === 'string') props[key] = value.slice(0, 120);
        else if (typeof value === 'number' && Number.isFinite(value)) props[key] = value;
        else if (typeof value === 'boolean') props[key] = value;
      });
      // Tree identity is fixed content, never the visitor's entered name.
      var treeKey = document.body && document.body.dataset.tree;
      if (treeKey && window.LNDB && LNDB.trees[treeKey]) {
        props.tree = props.tree || LNDB.trees[treeKey].name;
        props.entry = new URLSearchParams(location.search).get('from') === 'quiz' ? 'quiz' : 'other';
      }
      window.plausible(eventName, { props: props });
    } catch (_) { /* Analytics must never interrupt checkout, downloads, or forms. */ }
  };

  function sanitizeUrl(value, keepCampaign) {
    var url = new URL(value, location.origin);
    var campaign = new URLSearchParams();
    if (keepCampaign) ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      if (url.searchParams.has(key)) campaign.set(key, url.searchParams.get(key));
    });
    url.search = campaign.toString();
    url.hash = '';
    return url.href;
  }

  window.plausible.init({
    // Form submission attempts are tracked explicitly, with group and outcome.
    formSubmissions: false,
    transformRequest: function (payload) {
      try {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;
        payload.u = sanitizeUrl(payload.u, true);
        if (payload.r) payload.r = sanitizeUrl(payload.r, false);
        if (payload.p) {
          // Automatic outbound links can contain names/dedications in WhatsApp text.
          if (payload.p.url) payload.p.url = sanitizeUrl(payload.p.url, false);
          ['email', 'name', 'phone', 'address', 'reference', 'ref', 'code', 'notes'].forEach(function (key) {
            delete payload.p[key];
          });
        }
        return payload;
      } catch (_) { return null; }
    }
  });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://plausible.io/js/pa-u_DKYx2k3O_ZCnip5FONF.js';
  document.head.appendChild(script);

  // Delegation covers header/footer injected after page load, plus keyboard clicks.
  function trackClick(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    var element = event.target.closest('a, button');
    if (!element || element.disabled) return;
    var tagged = element.closest('[data-track-event]');
    if (tagged) {
      var props = {};
      ['action', 'placement', 'type', 'asset', 'format'].forEach(function (key) {
        if (tagged.dataset['track' + key[0].toUpperCase() + key.slice(1)]) {
          props[key] = tagged.dataset['track' + key[0].toUpperCase() + key.slice(1)];
        }
      });
      window.lndbTrack(tagged.dataset.trackEvent, { props: props });
      return;
    }
    if (element.matches('.nav-toggle')) {
      window.lndbTrack('Navigation Toggle', { props: { action: element.getAttribute('aria-expanded') === 'true' ? 'open' : 'close', placement: 'header' } });
    } else if (element.matches('#header a, #footer a') && element.getAttribute('href').startsWith('/')) {
      window.lndbTrack('Navigation Click', { props: { destination: new URL(element.href).pathname, placement: element.closest('#header') ? 'header' : 'footer' } });
    } else if (element.matches('.contact-section a')) {
      var href = element.getAttribute('href');
      var channel = href.indexOf('mailto:') === 0 ? 'email' : href.indexOf('https://wa.me/') === 0 ? 'whatsapp' : 'instagram';
      window.lndbTrack('Contact Click', { props: { type: channel, placement: 'contact' } });
    } else if (element.matches('.newsletter-quiz-btn')) {
      window.lndbTrack('CTA Click', { props: { type: 'quiz', placement: 'newsletter_success' } });
    } else if (element.matches('.tree-nav-prev, .tree-nav-next, .tree-prevnext-prev, .tree-prevnext-next, .tree-ritual-next')) {
      window.lndbTrack('Tree Navigation', { props: {
        destination: new URL(element.href).pathname,
        placement: element.matches('.tree-ritual-next') ? 'completion' : element.matches('.tree-nav-prev, .tree-nav-next') ? 'hero' : 'bottom',
        action: element.matches('.tree-nav-prev, .tree-prevnext-prev') ? 'previous' : 'next'
      } });
    } else if (element.matches('.tree-gift a, .tree-nudge a')) {
      window.lndbTrack('CTA Click', { props: { type: 'quiz', placement: element.closest('.tree-nudge') ? 'nudge' : 'tree_gift' } });
    } else if (element.matches('.tree-hero-scroll')) {
      window.lndbTrack('Tree Content Click', { props: { placement: 'hero' } });
    }
  }
  // Count a CTA exposure once when its action area actually enters the viewport.
  if ('IntersectionObserver' in window) {
    var viewed = new WeakSet();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || viewed.has(entry.target)) return;
        viewed.add(entry.target);
        window.lndbTrack('CTA Viewed', { props: { type: entry.target.dataset.analyticsType, placement: entry.target.dataset.analyticsPlacement } });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    [['.drawing-guide-actions', 'mango_guide', 'drawing_guide'], ['.product-actions', 'book', 'book'], ['.arboleda-content .btn', 'arboleda', 'arboleda'], ['.tree-quiz .btn', 'quiz', 'quiz'], ['.newsletter-form', 'newsletter', 'newsletter']].forEach(function (item) {
      document.querySelectorAll(item[0]).forEach(function (el) {
        el.dataset.analyticsType = item[1];
        el.dataset.analyticsPlacement = item[2];
        observer.observe(el);
      });
    });
  }
  document.addEventListener('click', trackClick);
  document.addEventListener('auxclick', trackClick);
})();
