/**
 * Product grid + shopping cart — Los Nombres del Bosque
 * Products come from /api/products and every total from /api/quote, so prices and
 * shipping rules live only on the server. Checkout itself stays in js/checkout.js.
 */
(function () {
  'use strict';

  var KEY = 'lndb-cart';
  var MAX_QTY = 10;
  // ponytail: no code field in the cart (codes are hidden site-wide). For sandbox payments
  // open /productos?code=TEST — same TEST behaviour as the book checkout.
  // The code is remembered for the tab, so it survives the hop from another page's cart to /productos.
  var discountCode = new URLSearchParams(location.search).get('code') || '';
  try {
    if (discountCode) sessionStorage.setItem('lndb-code', discountCode);
    else discountCode = sessionStorage.getItem('lndb-code') || '';
  } catch (_) {}
  var cart = {}; // { sku: qty }
  var quote = null;

  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) cart = saved;
  } catch (_) { /* no storage: the cart still works for this page view */ }

  function cop(cents) {
    return '$' + (cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function track(name, props) {
    if (typeof window.lndbTrack === 'function') window.lndbTrack(name, { props: props });
  }

  function items() {
    return Object.keys(cart).map(function (sku) { return { sku: sku, qty: cart[sku] }; });
  }

  function setQty(sku, qty) {
    if (qty < 1) delete cart[sku];
    else cart[sku] = Math.min(MAX_QTY, qty);
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (_) {}
    refresh();
  }

  // ---- Cart UI ----
  var fab = el('button', 'cart-fab');
  fab.type = 'button';
  fab.hidden = true;
  var dialog = el('dialog', 'cart-dialog');
  dialog.setAttribute('aria-labelledby', 'cart-title');
  dialog.innerHTML =
    '<button type="button" class="checkout-modal-close" data-cart-close aria-label="Cerrar">&times;</button>' +
    '<h2 id="cart-title">Tu carrito</h2>' +
    '<ul class="cart-lines" data-cart-lines></ul>' +
    '<p class="cart-empty" data-cart-empty>Tu carrito está vacío.</p>' +
    '<dl class="cart-totals" data-cart-totals></dl>' +
    '<button type="button" class="btn btn-primary" data-cart-pay>Continuar con el pago</button>';
  document.body.appendChild(fab);
  document.body.appendChild(dialog);

  var linesEl = dialog.querySelector('[data-cart-lines]');
  var emptyEl = dialog.querySelector('[data-cart-empty]');
  var totalsEl = dialog.querySelector('[data-cart-totals]');
  var payBtn = dialog.querySelector('[data-cart-pay]');

  fab.addEventListener('click', function () { dialog.showModal(); track('Cart Opened'); });
  dialog.querySelector('[data-cart-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

  payBtn.addEventListener('click', function () {
    if (!quote) return;
    // Only pages that sell load the payment form; from anywhere else, pay on the products page.
    if (typeof window.lndbCheckout !== 'function') { location.href = '/productos#carrito'; return; }
    dialog.close();
    window.lndbCheckout({
      items: items(),
      discountCode: discountCode,
      quantity: quote.quantity,
      totalCents: quote.totalCents,
      summary: quote.lines.map(function (line) { return line.qty + ' × ' + line.name; }).join(', ')
    });
  });

  // ---- Photo zoom ----
  var zoom = el('dialog', 'zoom-dialog');
  zoom.setAttribute('aria-label', 'Foto ampliada');
  var zoomImg = el('img');
  zoom.appendChild(zoomImg);
  document.body.appendChild(zoom);
  zoom.addEventListener('click', function () { zoom.close(); }); // click anywhere (or Esc) closes

  // base = product image path without size/extension; sizes come from scripts/optimize-photo.sh
  function photo(base, size) { return '/' + base + '-' + size + '.webp'; }

  function zoomable(img, name, base) {
    img.classList.add('zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Ampliar foto de ' + name);
    function open() {
      zoomImg.src = photo(base, 1600); // the big file loads only when someone zooms
      zoomImg.alt = name;
      zoom.showModal();
    }
    img.addEventListener('click', open);
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  }

  function stepButton(label, text, sku, qty) {
    var btn = el('button', 'qty-stepper-btn', text);
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', function () { setQty(sku, qty); });
    return btn;
  }

  function render() {
    var count = quote ? quote.quantity : 0;
    fab.hidden = !count;
    fab.textContent = 'Carrito · ' + count;
    emptyEl.hidden = !!count;
    payBtn.hidden = totalsEl.hidden = !count;
    linesEl.textContent = '';
    totalsEl.textContent = '';
    if (!quote) return;

    // Items with a photo first, photo-less ones (gift bag) last; otherwise the order they were added.
    quote.lines.slice().sort(function (a, b) { return !a.image - !b.image; }).forEach(function (line) {
      var row = el('li', 'cart-line');
      // Thumbnail where the product has a photo; an empty cell otherwise so the names stay aligned.
      var thumb = el(line.image ? 'img' : 'span', 'cart-line-thumb');
      if (line.image) {
        thumb.src = photo(line.image, 480);
        thumb.alt = '';
        zoomable(thumb, line.name, line.image);
      }
      row.appendChild(thumb);
      row.appendChild(el('span', 'cart-line-name', line.name));
      var stepper = el('span', 'qty-stepper');
      stepper.appendChild(stepButton(line.qty === 1 ? 'Quitar ' + line.name : 'Disminuir cantidad', '−', line.sku, line.qty - 1));
      stepper.appendChild(el('span', 'qty-stepper-value', line.qty));
      var plus = stepButton('Aumentar cantidad', '+', line.sku, line.qty + 1);
      plus.disabled = line.qty >= MAX_QTY;
      stepper.appendChild(plus);
      row.appendChild(stepper);
      row.appendChild(el('span', 'cart-line-price', cop(line.lineCents)));
      linesEl.appendChild(row);
    });

    [['Subtotal', quote.subtotalCents], ['Envío', quote.shippingCents], ['Total', quote.totalCents]].forEach(function (pair) {
      totalsEl.appendChild(el('dt', null, pair[0]));
      totalsEl.appendChild(el('dd', null, cop(pair[1])));
    });
  }

  // Arriving from another page's cart: reopen it here, where the payment form lives.
  var reopen = location.hash === '#carrito';
  // The thank-you page means the order is placed.
  if (/^\/exito(\.html)?$/.test(location.pathname)) {
    cart = {};
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  var latest = 0;
  function refresh() {
    var request = ++latest;
    if (!items().length) { quote = null; render(); return; }
    fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items(), discountCode: discountCode })
    }).then(function (r) {
      if (r.status === 400) {
        // A saved cart can name a product that no longer exists: start over rather than block checkout.
        cart = {};
        try { localStorage.removeItem(KEY); } catch (_) {}
        return null;
      }
      if (!r.ok) throw new Error('quote failed');
      return r.json();
    }).then(function (data) {
      if (request !== latest) return; // a newer change is already on its way
      quote = data;
      render();
      if (reopen && quote && !dialog.open) dialog.showModal();
      reopen = false;
    }).catch(function () { /* keep showing the last good totals */ });
  }

  // ---- Product grid ----
  function card(product) {
    var node = el('article', 'navidad-card');
    if (product.image) {
      var img = el('img');
      // the browser picks the small file on ordinary screens and the 800px one on sharp or wide ones
      img.srcset = photo(product.image, 480) + ' 480w, ' + photo(product.image, 800) + ' 800w';
      img.sizes = '(max-width: 560px) 90vw, 320px';
      img.src = photo(product.image, 800);
      img.alt = product.name;
      img.loading = 'lazy';
      zoomable(img, product.name, product.image);
      node.appendChild(img);
    }
    var body = el('div', 'navidad-card-body');
    body.appendChild(el('h3', null, product.name));
    body.appendChild(el('p', 'navidad-card-tagline', product.tagline));
    body.appendChild(el('p', null, product.description));
    if (product.includes) body.appendChild(el('p', 'navidad-card-includes', 'Incluye: ' + product.includes));

    var price = el('p', 'product-price');
    var select = null;
    if (product.variants.length > 1) {
      select = el('select', 'navidad-card-variant');
      select.setAttribute('aria-label', 'Opción de ' + product.name);
      product.variants.forEach(function (variant) {
        // Label only: the price for the chosen option shows right below, and a price here gets cut off on narrow cards.
        var option = el('option', null, variant.label || product.name);
        option.value = variant.sku;
        select.appendChild(option);
      });
      body.appendChild(select);
      // Prices for every option up front. An unlabelled first option is the base product, so the
      // others read as an extra ("En caja de madera: +$4.000"); otherwise list each option's price.
      var base = product.variants[0];
      body.appendChild(el('p', 'navidad-card-includes', product.variants.filter(function (variant) {
        return variant.label;
      }).map(function (variant) {
        return base.label
          ? variant.label + ' ' + cop(variant.priceCents)
          : variant.label + ': +' + cop(variant.priceCents - base.priceCents);
      }).join(' · ')));
    }
    function chosen() {
      return product.variants.filter(function (v) { return !select || v.sku === select.value; })[0];
    }
    function showPrice() { price.textContent = cop(chosen().priceCents); }
    if (select) select.addEventListener('change', showPrice);
    showPrice();
    body.appendChild(price);

    var add = el('button', 'btn btn-primary', 'Agregar al carrito');
    add.type = 'button';
    add.addEventListener('click', function () {
      var sku = chosen().sku;
      setQty(sku, (cart[sku] || 0) + 1);
      track('Add To Cart', { type: sku, placement: 'navidad', amount: chosen().priceCents / 100 });
      add.textContent = 'Agregado ✓';
      setTimeout(function () { add.textContent = 'Agregar al carrito'; }, 1200);
    });
    body.appendChild(add);
    node.appendChild(body);
    return node;
  }

  var grid = document.querySelector('[data-product-grid]');
  if (grid) {
    fetch('/api/products').then(function (r) { return r.json(); }).then(function (products) {
      products.forEach(function (product) { grid.appendChild(card(product)); });
    }).catch(function () {
      grid.textContent = 'No pudimos cargar los productos. Recarga la página o escríbenos por WhatsApp.';
    });
  }

  refresh();
})();
