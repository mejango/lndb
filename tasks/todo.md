# ¿Qué árbol eres? (Jev) — productos.html

- [x] `js/trees.js`: export LNDB for Node so server reuses tree descriptions
- [x] `server.js`: `POST /api/arbol` → TypeSafe `jev-latest` Choice over 16 trees (criteria = descriptions)
- [x] `productos.html`: new `.tree-match` section at end (textarea + probability bars)
- [x] `css/styles.css`: bars styling
- [x] Railway: copy TYPESAFE_API_KEY from No Operation/noop-server → LNDB
- [x] Verify: curl endpoint locally with real key; browser check

## Review
- Endpoint verified locally with real key: party-host text → Mango 95%; quiet-observer text → Cenizo 94%. Short input → 400.
- Desktop + mobile screenshots OK, no console errors. Existing tests pass.
- Key set on Railway LNDB with `--skip-deploys`; next deploy picks it up. Not committed.

# Navidad 2026 products + cart (prototype)

- [x] `data/products.json` + `lib/catalog.cjs`: server-side product list, startup validation, `priceOrder`
- [x] `server.js`: `GET /api/products`, `POST /api/quote`, `/api/checkout` accepts cart `items` (book button unchanged), email lists order lines
- [x] `js/cart.js`: product grid, cart dialog (localStorage), totals from the server
- [x] `js/checkout.js`: modal accepts a cart via `window.lndbCheckout`
- [x] `productos.html` Navidad section, `index.html` teaser, CSS
- [x] `tests/catalog.test.cjs`; all tests pass; endpoints checked with curl
- [x] Browser check (grid, cart, checkout modal, mobile)
- [x] Cart site-wide (loaded from `js/components.js`; pays on `/productos#carrito`)
- [x] Meta AddToCart / InitiateCheckout / Purchase carry the actual products
- [x] Full-resolution photos: three WebP sizes each via `scripts/optimize-photo.sh` (480/800 for cards, 1600 for zoom only)
- [ ] Photo for the gift bag (none supplied)
- [x] Shipping: one flat rate for everything (`SHIPPING_COST_CENTS`); per-product override stays available in `data/products.json`
