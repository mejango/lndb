/**
 * Los Nombres del Bosque — Shared Components
 * Fetch-and-inject pattern for header/footer.
 * Requires HTTP server (file:// blocked by CORS).
 */

(function () {
  'use strict';

  // Determine base path from current page location
  var depth = 0;
  var path = window.location.pathname;
  if (path.indexOf('/arboles/') !== -1) depth = 1;

  var base = depth === 1 ? '../' : '';

  function inject(id, file) {
    var el = document.getElementById(id);
    if (!el) return;

    fetch(base + file)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        el.innerHTML = html;

        // Mark active nav link
        if (id === 'header') {
          initNav(el);
        }
      })
      .catch(function () {
        // Silent fail — page still works without shared header/footer
      });
  }

  function initNav(header) {
    // Set active link based on current page
    var current = window.location.pathname.split('/').pop() || 'index.html';
    var links = header.querySelectorAll('.nav-links a');
    links.forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === current || (current === '' && href === 'index.html')) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });

    // Mobile toggle
    var toggle = header.querySelector('.nav-toggle');
    var navLinks = header.querySelector('.nav-links');
    if (toggle && navLinks) {
      toggle.addEventListener('click', function () {
        var isOpen = navLinks.classList.toggle('active');
        toggle.classList.toggle('active');
        toggle.setAttribute('aria-expanded', isOpen);
      });
      navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          navLinks.classList.remove('active');
          toggle.classList.remove('active');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  inject('header', 'components/header.html');
  inject('footer', 'components/footer.html');
})();
