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

  function track(eventName, props) {
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, props);
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

    // Close handlers
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', escHandler);

    // Step 1 → Step 2
    nextBtn.addEventListener('click', function () {
      if (!nameInput.value.trim() || !emailInput.value.trim()) {
        highlightEmpty([nameInput, emailInput]);
        return;
      }
      if (!isValidEmail(emailInput.value.trim())) {
        emailInput.style.borderColor = 'var(--color-coral)';
        return;
      }
      collected.name = nameInput.value.trim();
      collected.email = emailInput.value.trim();

      step1.classList.remove('active');
      step2.classList.add('active');
      stepText.textContent = 'Paso 2 de 2';
      overlay.querySelector('#checkout-address').focus();
    });

    // Back
    backBtn.addEventListener('click', function () {
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
        highlightEmpty([address, city, dept, phone]);
        return;
      }

      collected.address = address.value.trim();
      collected.city = city.value.trim();
      collected.department = dept.value;
      collected.phone = phone.value.trim();
      collected.notes = notes.value.trim();

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
        _subject: 'Nueva orden',
        source: 'checkout'
      };

      // Read discount code from the page (outside modal)
      var section = currentBtn.closest('.product-text, .book-section, section');
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

      // Call /api/checkout, then open Wompi
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountCode: discountCode,
          shippingAddress: shippingAddress
        })
      })
        .then(function (r) {
          return r.json().catch(function () {
            throw new Error('Respuesta invalida del servidor');
          }).then(function (data) {
            if (!r.ok) {
              throw new Error((data && data.error) || 'No pudimos preparar el checkout');
            }
            return data;
          });
        })
        .then(function (data) {
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

          track('Checkout Started', {
            props: { discount: data.discountApplied ? 'yes' : 'no' }
          });

          closeModal();

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

          checkout.open(function (result) {
            var tx = result.transaction;
            if (tx && tx.status === 'APPROVED') {
              track('Purchase Completed', { props: { reference: data.reference } });
              window.location.href = data.redirectUrl + '?ref=' + data.reference;
            }
          });
        })
        .catch(function (err) {
          track('Checkout Error');
          console.error('Checkout init failed', err);
          payBtn.disabled = false;
          payBtn.textContent = 'Pagar';
          alert('No pudimos iniciar el pago. Escríbenos por WhatsApp para completar tu compra.');
        });
    });

    setTimeout(function () { nameInput.focus(); }, 50);
  }

  function closeModal() {
    if (overlay) {
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
      overlay = null;
    }
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') closeModal();
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

  // ---- Bind buttons ----
  document.querySelectorAll('[data-checkout]').forEach(function (btn) {
    // Preserve discount code real-time validation (unchanged)
    var section = btn.closest('.product-text, .book-section, section');
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
                track('Discount Code Applied', { props: { code: code } });
                priceEl.childNodes[0].textContent = data.priceFormatted + ' ';
                codeInput.classList.add('discount-valid');
                codeInput.classList.remove('discount-invalid');
              } else {
                priceEl.childNodes[0].textContent = originalPrice + ' ';
                codeInput.classList.add('discount-invalid');
                codeInput.classList.remove('discount-valid');
              }
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
