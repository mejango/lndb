/**
 * Wompi Checkout — Los Nombres del Bosque
 */
(function () {
  'use strict';

  document.querySelectorAll('[data-checkout]').forEach(function (btn) {
    // Find discount input — search up to the nearest section or product-text container
    var section = btn.closest('.product-text, .book-section, section');
    var codeInput = section ? section.querySelector('[data-discount-code]') : null;
    var priceEl = section ? section.querySelector('.product-price') : null;
    var originalPrice = priceEl ? priceEl.childNodes[0].textContent.trim() : '';

    // Real-time discount validation
    if (codeInput) {
      var debounceTimer;
      codeInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        var code = codeInput.value.trim();
        if (!code) {
          // Reset to original price
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

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Preparando pago...';

      var discountCode = codeInput ? codeInput.value.trim() : '';

      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountCode: discountCode })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);

          plausible('Checkout Started', {
            props: { discount: data.discountApplied ? 'yes' : 'no' }
          });

          var checkout = new WidgetCheckout({
            currency: data.currency,
            amountInCents: data.amountInCents,
            reference: data.reference,
            publicKey: data.publicKey,
            signature: { integrity: data.signature },
            redirectUrl: data.redirectUrl
          });

          checkout.open(function (result) {
            var tx = result.transaction;
            if (tx && tx.status === 'APPROVED') {
              plausible('Purchase Completed', { props: { reference: data.reference } });
              window.location.href = data.redirectUrl + '?ref=' + data.reference;
            }
          });

          btn.disabled = false;
          btn.textContent = 'Comprar libro';
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Comprar libro';
          alert('No pudimos iniciar el pago. Escríbenos por WhatsApp para completar tu compra.');
        });
    });
  });
})();
