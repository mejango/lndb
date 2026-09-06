/**
 * Wompi Checkout — Los Nombres del Bosque
 * Two-step modal: contact info → shipping address → Formspree + Wompi
 */
(function () {
  'use strict';

  var DEPARTMENTS = [
    'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
    'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
    'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
    'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
    'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
    'Valle del Cauca', 'Vaupés', 'Vichada'
  ];

  var FORMSPREE_URL = 'https://formspree.io/f/mreyvela';

  var checkoutContext = {};
  function track(eventName, options) {
    if (typeof window.lndbTrack === 'function') {
      window.lndbTrack(eventName, { props: Object.assign({}, checkoutContext, options && options.props) });
    }
  }

  // ---- Modal HTML ----
  function buildModal() {
    var deptOptions = '<option value="">Seleccionar...</option>';
    DEPARTMENTS.forEach(function (d) {
      deptOptions += '<option value="' + d + '">' + d + '</option>';
    });

    var html =
      '<div class="checkout-modal-overlay" id="checkout-overlay">' +
        '<div class="checkout-modal">' +
          '<button class="checkout-modal-close" id="checkout-close" aria-label="Cerrar">&times;</button>' +
          '<h2>Datos de envío</h2>' +
          '<p class="checkout-steps-indicator" id="checkout-step-text">Paso 1 de 2</p>' +

          // Step 1
          '<div class="checkout-step active" id="checkout-step-1">' +
            '<div class="qty-stepper-row">' +
              '<span class="qty-stepper-row-label">Cantidad</span>' +
              '<span class="qty-stepper" data-modal-qty-stepper>' +
                '<button type="button" class="qty-stepper-btn" data-modal-qty-minus aria-label="Disminuir cantidad">−</button>' +
                '<span class="qty-stepper-value" data-modal-qty-value>1</span>' +
                '<button type="button" class="qty-stepper-btn" data-modal-qty-plus aria-label="Aumentar cantidad">+</button>' +
              '</span>' +
            '</div>' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-name">Nombre completo</label>' +
              '<input type="text" id="checkout-name" required placeholder="Tu nombre">' +
            '</div>' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-email">Correo electrónico</label>' +
              '<input type="email" id="checkout-email" required placeholder="tu@correo.com">' +
            '</div>' +
            '<button class="btn btn-primary" id="checkout-next">Siguiente</button>' +
          '</div>' +

          // Step 2
          '<div class="checkout-step" id="checkout-step-2">' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-address">Dirección</label>' +
              '<input type="text" id="checkout-address" required placeholder="Calle, carrera, número">' +
            '</div>' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-city">Ciudad</label>' +
              '<input type="text" id="checkout-city" required placeholder="Ej: Bogotá">' +
            '</div>' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-department">Departamento</label>' +
              '<select id="checkout-department" required>' + deptOptions + '</select>' +
            '</div>' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-phone">Teléfono</label>' +
              '<input type="tel" id="checkout-phone" required placeholder="300 123 4567">' +
            '</div>' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-notes">Notas <span style="font-weight:400;color:var(--color-text-muted)">(opcional)</span></label>' +
              '<input type="text" id="checkout-notes" placeholder="Apto, edificio, referencias">' +
            '</div>' +
            '<p class="checkout-total-line" id="checkout-total-line"><span class="checkout-total-label">Total:</span>$98.000</p>' +
            '<button class="btn btn-primary" id="checkout-pay">Pagar</button>' +
            '<button class="checkout-modal-back" id="checkout-back">&larr; Volver</button>' +
          '</div>' +

        '</div>' +
      '</div>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.firstChild;
  }

  // ---- Modal lifecycle ----
  var overlay = null;
  var collected = {};
  var currentBtn = null;

  function openModal(btn) {
    currentBtn = btn;
    collected = {};
    overlay = buildModal();
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var nameInput = overlay.querySelector('#checkout-name');
    var emailInput = overlay.querySelector('#checkout-email');
    var step1 = overlay.querySelector('#checkout-step-1');
    var step2 = overlay.querySelector('#checkout-step-2');
    var stepText = overlay.querySelector('#checkout-step-text');
    var nextBtn = overlay.querySelector('#checkout-next');
    var backBtn = overlay.querySelector('#checkout-back');
    var payBtn = overlay.querySelector('#checkout-pay');
    var closeBtn = overlay.querySelector('#checkout-close');

    // Modal qty stepper
    var modalQtyValue = overlay.querySelector('[data-modal-qty-value]');
    var modalQtyMinus = overlay.querySelector('[data-modal-qty-minus]');
    var modalQtyPlus = overlay.querySelector('[data-modal-qty-plus]');
    var modalTotalLine = overlay.querySelector('#checkout-total-line');

    // Pre-fill from the product page section the button belongs to
    var section = btn.closest('.product-text, .book-section, section');
    var initialQty = getQty(section);
    var modalQty = initialQty;
    checkoutContext = { quantity: modalQty, step: 'contact', type: 'book' };
    track('Checkout Opened');

    function renderModalTotal() {
      var unit = getUnitCents(section);
      var total = unit * modalQty + SHIPPING_CENTS;
      if (modalTotalLine) {
        modalTotalLine.innerHTML = '<span class="checkout-total-label">Total:</span>' + formatCop(total);
      }
      if (modalQtyValue) modalQtyValue.textContent = String(modalQty);
      if (modalQtyMinus) modalQtyMinus.disabled = modalQty <= MIN_QTY;
      if (modalQtyPlus) modalQtyPlus.disabled = modalQty >= MAX_QTY;
    }

    if (modalQtyMinus) {
      modalQtyMinus.addEventListener('click', function () {
        if (modalQty > MIN_QTY) { modalQty--; renderModalTotal(); checkoutContext.quantity = modalQty; track('Quantity Changed', { props: { placement: 'checkout', action: 'decrease' } }); }
      });
    }
    if (modalQtyPlus) {
      modalQtyPlus.addEventListener('click', function () {
        if (modalQty < MAX_QTY) { modalQty++; renderModalTotal(); checkoutContext.quantity = modalQty; track('Quantity Changed', { props: { placement: 'checkout', action: 'increase' } }); }
      });
    }
    renderModalTotal();

    // Close handlers
    closeBtn.addEventListener('click', function () { closeModal('close_button'); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal('backdrop');
    });
    document.addEventListener('keydown', escHandler);

    // Step 1 → Step 2
    nextBtn.addEventListener('click', function () {
      if (!nameInput.value.trim() || !emailInput.value.trim()) {
        track('Checkout Validation Error', { props: { reason: 'missing_contact' } });
        highlightEmpty([nameInput, emailInput]);
        return;
      }
      if (!isValidEmail(emailInput.value.trim())) {
        track('Checkout Validation Error', { props: { reason: 'invalid_email' } });
        emailInput.style.borderColor = 'var(--color-coral)';
        return;
      }
      collected.name = nameInput.value.trim();
      collected.email = emailInput.value.trim();
      track('Checkout Contact Submitted');
      checkoutContext.step = 'address';

      step1.classList.remove('active');
      step2.classList.add('active');
      stepText.textContent = 'Paso 2 de 2';
      overlay.querySelector('#checkout-address').focus();
    });

    // Back
    backBtn.addEventListener('click', function () {
      track('Checkout Back');
      checkoutContext.step = 'contact';
      step2.classList.remove('active');
      step1.classList.add('active');
      stepText.textContent = 'Paso 1 de 2';
    });

    // Step 2 → submit
    payBtn.addEventListener('click', function () {
      var address = overlay.querySelector('#checkout-address');
      var city = overlay.querySelector('#checkout-city');
      var dept = overlay.querySelector('#checkout-department');
      var phone = overlay.querySelector('#checkout-phone');
      var notes = overlay.querySelector('#checkout-notes');

      if (!address.value.trim() || !city.value.trim() || !dept.value || !phone.value.trim()) {
        track('Checkout Validation Error', { props: { reason: 'missing_address' } });
        highlightEmpty([address, city, dept, phone]);
        return;
      }

      collected.address = address.value.trim();
      collected.city = city.value.trim();
      collected.department = dept.value;
      collected.phone = phone.value.trim();
      collected.notes = notes.value.trim();
      track('Checkout Address Submitted');

      payBtn.disabled = true;
      payBtn.textContent = 'Procesando...';

      // Single Formspree entry with all data
      var formData = {
        name: collected.name,
        email: collected.email,
        address: collected.address,
        city: collected.city,
        department: collected.department,
        phone: collected.phone,
        notes: collected.notes || '',
        quantity: modalQty,
        _subject: 'Nueva orden',
        source: 'checkout'
      };

      // Read discount code from the page (outside modal)
      var codeInput = section ? section.querySelector('[data-discount-code]') : null;
      var discountCode = codeInput ? codeInput.value.trim() : '';

      var shippingAddress = {
        addressLine1: collected.address,
        addressLine2: collected.notes || undefined,
        city: collected.city,
        region: collected.department,
        country: 'CO',
        phoneNumber: collected.phone,
        name: collected.name
      };

      // POST to Formspree (fire-and-forget — don't block checkout)
      fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(formData)
      }).catch(function () {});

      // MailerLite signup outcome is separate from the payment outcome.
      track('Signup Submitted', { props: { group: 'checkout' } });
      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: collected.name, email: collected.email, group: 'checkout' })
      }).then(function (r) {
        track(r.ok ? 'Email Signup' : 'Signup Error', { props: { group: 'checkout', reason: r.ok ? 'accepted' : 'server' } });
      }).catch(function () { track('Signup Error', { props: { group: 'checkout', reason: 'network' } }); });

      var errorReason = 'network';
      // Call /api/checkout, then open Wompi
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: modalQty,
          discountCode: discountCode,
          shippingAddress: shippingAddress
        })
      })
        .then(function (r) {
          return r.json().catch(function () {
            errorReason = 'invalid_response';
            throw new Error('Respuesta invalida del servidor');
          }).then(function (data) {
            if (!r.ok) {
              errorReason = 'server';
              throw new Error((data && data.error) || 'No pudimos preparar el checkout');
            }
            return data;
          });
        })
        .then(function (data) {
          errorReason = 'payment_configuration';
          if (data.error) throw new Error(data.error);
          if (typeof window.WidgetCheckout !== 'function') {
            throw new Error('Widget de Wompi no disponible');
          }
          if (!data.publicKey) {
            throw new Error('Llave publica de Wompi faltante');
          }
          if (!data.signature) {
            throw new Error('Firma de integridad faltante');
          }

          closeModal('payment');

          var checkout = new WidgetCheckout({
            currency: data.currency,
            amountInCents: data.amountInCents,
            reference: data.reference,
            publicKey: data.publicKey,
            signature: { integrity: data.signature },
            redirectUrl: data.redirectUrl,
            shippingAddress: data.shippingAddress,
            customerData: {
              email: collected.email,
              fullName: collected.name,
              phoneNumber: collected.phone,
              phoneNumberPrefix: '+57'
            }
          });

          checkoutContext.step = 'payment';
          var purchaseTracked = false;
          checkout.open(function (result) {
            var tx = result && result.transaction;
            var status = tx && ['APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'PENDING'].includes(tx.status) ? tx.status : 'closed';
            var paymentMethod = tx && ['CARD', 'NEQUI', 'PSE', 'BANCOLOMBIA_TRANSFER', 'BANCOLOMBIA_COLLECT', 'DAVIPLATA'].includes(tx.payment_method_type) ? tx.payment_method_type : 'other';
            var paymentProps = { status: status, quantity: data.quantity, amount: data.amountInCents / 100, currency: data.currency, discount: data.discountApplied ? 'yes' : 'no', payment_method: paymentMethod, type: data.publicKey.indexOf('pub_test') === 0 ? 'test' : 'book' };
            track('Checkout Payment Result', { props: paymentProps });
            if (tx && tx.status === 'APPROVED') {
              if (paymentProps.type !== 'test' && !purchaseTracked) {
                purchaseTracked = true;
                track('Purchase Completed', { props: paymentProps });
              }
              window.location.href = data.redirectUrl + '?ref=' + data.reference;
            }
          });
          track('Checkout Started', { props: { discount: data.discountApplied ? 'yes' : 'no', quantity: data.quantity, amount: data.amountInCents / 100, currency: data.currency } });
        })
        .catch(function (err) {
          track('Checkout Error', { props: { reason: errorReason } });
          console.error('Checkout init failed', err);
          payBtn.disabled = false;
          payBtn.textContent = 'Pagar';
          alert('No pudimos iniciar el pago. Escríbenos por WhatsApp para completar tu compra.');
        });
    });

    setTimeout(function () { nameInput.focus(); }, 50);
  }

  function closeModal(reason) {
    if (overlay) {
      if (reason !== 'payment') track('Checkout Closed', { props: { reason: reason || 'close' } });
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
      overlay = null;
    }
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') closeModal('escape');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function highlightEmpty(fields) {
    fields.forEach(function (f) {
      if ((f.tagName === 'SELECT' && !f.value) || !f.value.trim()) {
        f.style.borderColor = 'var(--color-coral)';
        f.addEventListener('input', function handler() {
          f.style.borderColor = '';
          f.removeEventListener('input', handler);
        });
        f.addEventListener('change', function handler() {
          f.style.borderColor = '';
          f.removeEventListener('change', handler);
        });
      }
    });
  }

  // ---- Quantity helpers ----
  var MIN_QTY = 1;
  var MAX_QTY = 10;
  var SHIPPING_CENTS = 1800000; // $18.000 — must match SHIPPING_COST_CENTS on server
  var DEFAULT_UNIT_CENTS = 8000000; // $80.000 — full price

  function formatCop(cents) {
    return '$' + (cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function parseCop(str) {
    // "$80.000" or "$80.000 " → 8000000 (cents)
    var digits = (str || '').replace(/[^0-9]/g, '');
    var cents = digits ? parseInt(digits, 10) * 100 : DEFAULT_UNIT_CENTS;
    return cents;
  }

  function getUnitCents(section) {
    var priceEl = section ? section.querySelector('.product-price') : null;
    if (!priceEl) return DEFAULT_UNIT_CENTS;
    return parseCop(priceEl.childNodes[0].textContent);
  }

  function getQty(section) {
    var valueEl = section ? section.querySelector('[data-qty-value]') : null;
    if (!valueEl) return 1;
    var n = parseInt(valueEl.textContent, 10);
    return n >= MIN_QTY && n <= MAX_QTY ? n : 1;
  }

  function renderTotal(section) {
    if (!section) return;
    var totalEl = section.querySelector('[data-product-total]');
    if (!totalEl) return;
    var qty = getQty(section);
    var unit = getUnitCents(section);
    var total = unit * qty + SHIPPING_CENTS;
    totalEl.innerHTML = '<span class="product-total-label">Total:</span>' + formatCop(total);
  }

  function updateStepperButtons(section) {
    if (!section) return;
    var qty = getQty(section);
    var minus = section.querySelector('[data-qty-minus]');
    var plus = section.querySelector('[data-qty-plus]');
    if (minus) minus.disabled = qty <= MIN_QTY;
    if (plus) plus.disabled = qty >= MAX_QTY;
  }

  function setQty(section, qty) {
    if (!section) return;
    var clamped = Math.max(MIN_QTY, Math.min(MAX_QTY, qty | 0));
    var valueEl = section.querySelector('[data-qty-value]');
    if (valueEl) valueEl.textContent = String(clamped);
    updateStepperButtons(section);
    renderTotal(section);
  }

  // ---- Bind buttons ----
  document.querySelectorAll('[data-checkout]').forEach(function (btn) {
    // Preserve discount code real-time validation (unchanged)
    var section = btn.closest('.product-text, .book-section, section');

    // Stepper wiring (no-op if the markup is absent)
    var minusBtn = section ? section.querySelector('[data-qty-minus]') : null;
    var plusBtn = section ? section.querySelector('[data-qty-plus]') : null;
    if (minusBtn) {
      minusBtn.addEventListener('click', function () {
        setQty(section, getQty(section) - 1);
        window.lndbTrack('Quantity Changed', { props: { quantity: getQty(section), placement: 'product', action: 'decrease' } });
      });
    }
    if (plusBtn) {
      plusBtn.addEventListener('click', function () {
        setQty(section, getQty(section) + 1);
        window.lndbTrack('Quantity Changed', { props: { quantity: getQty(section), placement: 'product', action: 'increase' } });
      });
    }
    updateStepperButtons(section);
    renderTotal(section);

    var codeInput = section ? section.querySelector('[data-discount-code]') : null;
    var priceEl = section ? section.querySelector('.product-price') : null;
    var originalPrice = priceEl ? priceEl.childNodes[0].textContent.trim() : '';

    if (codeInput) {
      var debounceTimer;
      codeInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        var code = codeInput.value.trim();
        if (!code) {
          if (priceEl) priceEl.childNodes[0].textContent = originalPrice + ' ';
          codeInput.classList.remove('discount-valid', 'discount-invalid');
          renderTotal(section);
          return;
        }
        debounceTimer = setTimeout(function () {
          fetch('/api/validate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.valid) {
                track('Discount Code Applied', { props: { discount: 'yes' } });
                priceEl.childNodes[0].textContent = data.priceFormatted + ' ';
                codeInput.classList.add('discount-valid');
                codeInput.classList.remove('discount-invalid');
              } else {
                track('Discount Code Rejected', { props: { reason: 'invalid' } });
                priceEl.childNodes[0].textContent = originalPrice + ' ';
                codeInput.classList.add('discount-invalid');
                codeInput.classList.remove('discount-valid');
              }
              renderTotal(section);
            })
            .catch(function () {});
        }, 400);
      });
    }

    // Open modal on click instead of going straight to Wompi
    btn.addEventListener('click', function () {
      openModal(btn);
    });
  });
})();
