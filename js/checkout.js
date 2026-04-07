/**
 * Wompi Checkout — Los Nombres del Bosque
 */
(function () {
  'use strict';

  document.querySelectorAll('[data-checkout]').forEach(function (btn) {
    // Find the discount input near this button (if any)
    var container = btn.parentElement;
    var codeInput = container ? container.querySelector('[data-discount-code]') : null;

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
