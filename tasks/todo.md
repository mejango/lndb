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
