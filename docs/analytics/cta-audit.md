# CTA tracking audit — 2026-09-06

The site uses the existing Plausible tracker for `losnombresdelbosque`. Shared initialization and event handling now live in `js/analytics.js`, loaded before other page scripts. This audit changes event collection; it does not change Plausible dashboard goals or the subscription.

## Coverage

| Area | Events and useful context |
| --- | --- |
| Mango guide | `Guide Download Click` and `Guide Print Click`; PDF asset, action, placement. These are separate events even without property breakdowns. |
| Primary CTAs | Existing `CTA Click`, `Quiz CTA Click`, `Forest Tree Click`; page, placement, type, tree. `CTA Viewed` records one exposure per action area per page load. |
| Shared navigation | `Navigation Click`, `Navigation Toggle`; header/footer placement, canonical internal destination, open/close. Works with asynchronously injected components and middle-clicks. |
| Contact | `Contact Click` for product contact-section links; existing `WhatsApp Click` and footer `Social Click`; channel/type and placement. |
| Checkout | `Checkout Opened`, `Checkout Contact Submitted`, `Checkout Address Submitted`, `Checkout Started`, `Checkout Payment Result`, `Purchase Completed`; quantity, amount in COP, discount yes/no, step and payment result. |
| Checkout friction | `Checkout Validation Error`, `Checkout Back`, `Checkout Closed`, `Checkout Error`, `Quantity Changed`, `Discount Code Rejected`; bounded reasons, step, quantity, placement. Payment handoff is not counted as modal abandonment. |
| Signup | `Signup Submitted`, `Signup Error`, existing `Email Signup` and `Newsletter Signup`; group, page/source, tree where applicable. Success only follows an accepted server response. Checkout signup is measured separately from payment. |
| Quiz | `Quiz Started`, `Quiz Question Viewed`, `Quiz Answered`, `Quiz Completed`, `Quiz Retry`; numbered questions and answer positions, result tree. Rapid double clicks cannot advance/scoring-count the same answer twice. |
| Sharing | Existing `Quiz Shared` remains share intent. `Tree Share Click` and `Share Result` distinguish native sharing, clipboard copy, image-download initiation, cancellation and failure. The previously inert tree share buttons now share the canonical tree page. |
| Meditation | Existing start/completion, plus `Meditation Paused`, `Meditation Progress` and `Meditation Error`; tree, 25/50/75-percent playback-position milestones once per page load, bounded playback-error reason. |
| Tree exploration | `Tree Navigation`, `Tree Content Click`, `Tree Nudge Viewed`, `Tree Nudge Dismissed`, existing tree page and sound-toggle events; tree, placement, previous/next destination and quiz entry context. |
| ¿Qué árbol eres? | `CTA Viewed` (type `tree_match`), `Tree Match Started` once per page load on first keystroke, `Tree Match Result` after typing settles for 3s or the tab is hidden (result tree, `clear`/`mixed` outcome at 60% top probability, word count rounded up to tens and capped at 100), `Tree Match Click` (tree, list vs illustration), `Tree Match Error` (server/network). The typed text is never sent. |
| Arboleda | Existing start/selection/preview/download/print events plus add/remove/edit/update/picker actions, `Arboleda Preview Ready`, `Arboleda Export Result`; member count, tree, method and outcome. Cancelling native sharing no longer unexpectedly downloads the image. |
| Post-purchase | Existing arboleda, home and WhatsApp CTAs keep their event names and page context. Merely visiting `/exito` does not record a purchase. |

## Event semantics and privacy

- Existing event names are retained for historical continuity. `Quiz Shared` and `Arboleda Download` historically measure intent; use the new outcome events to distinguish completion or failure.
- A browser cannot confirm that a PDF was saved to disk or physically printed. Guide events measure clicks/download initiation and opening the PDF for printing.
- `Purchase Completed` requires an APPROVED Wompi widget callback, is emitted once per checkout instance, and excludes sandbox keys. This is browser-observed conversion telemetry, not an authoritative payment ledger: blocked analytics, redirects before callback, or closing the tab may undercount. No purchase is inferred from an unverified success-page visit.
- Purchase `amount` is the server-returned total including shipping, in COP units rather than cents. It is a custom property, not Plausible's paid revenue-goal feature.
- `Checkout Closed` records explicit modal dismissal, not every tab close or browser exit. Funnel gaps reveal additional drop-off.
- Playback milestones measure position reached, including seeking; they do not prove uninterrupted listening.
- Only an allowlist of scalar properties is accepted. Entered names, emails, phone numbers, addresses, dedication text, notes, raw discount codes and order references are excluded.
- The tracker transformation strips query strings/fragments from outbound URLs and referrers, including personalized WhatsApp messages. On page URLs it retains only standard UTM campaign parameters; checkout references and other query data are removed.
- Automatic generic form-submission tracking is disabled in favor of explicit attempts and accepted/error outcomes. Existing automatic outbound and file-download tracking stays enabled, with sanitized URLs. Do not sum those automatic events with the corresponding custom CTA events as if they were distinct actions.
- Localhost/127.0.0.1 traffic is suppressed before transmission. Browser QA uses a recorder instead of the live tracker and mocks signups, sharing and Wompi.
- `Aviso legal` and `Políticas` currently link to `#`, and the skip link is an accessibility control; none is counted as a business conversion. The footer placeholders still need real destination content separately.

## Useful analysis

- Guide interest: CTA exposure → download click or print-open click.
- Book funnel: checkout opened → contact submitted → address submitted → payment started → approved callback. Compare quantities, entry pages and error reasons.
- Quiz funnel: started → numbered question views/answers → completed → listen/arboleda CTA or email signup.
- Arboleda funnel: started → selected members → preview ready → export outcome or printed-version inquiry.
- Content engagement: tree entry → meditation started → position milestones → completed → share/next tree/visit signup.

Plausible custom property breakdowns and funnel UI availability depend on the account plan. Event collection does not require a Plausible API key. Dashboard goal configuration was explicitly excluded from this task.

## Verification

- `node --test tests/analytics.test.cjs`: property filtering, URL redaction/UTM preservation, failure isolation, guide click/middle-click handling, local-traffic suppression, all 22 pages' load order and inline-script syntax.
- Local browser: both guide CTAs, all three product contact links, modal opening/validation/dismissal, quantity, contact/address steps, mocked signup and payment; declined payment emitted no purchase and duplicate APPROVED callbacks emitted one purchase.
- Local browser: all seven quiz questions, rapid double clicks, completion, failed signup followed by successful retry, and reset.
- Local browser: three-person arboleda, preview rendering, mocked native export, printed-version inquiry, editing/removal, and absence of entered names in recorded events.
- Local browser: tree gift/navigation, both share buttons and outcomes, accepted visit signup, tree identity and quiz-origin context.

## References

- [Plausible custom events](https://plausible.io/docs/custom-event-goals)
- [Plausible custom properties and data restrictions](https://plausible.io/docs/custom-props/introduction)

## Meta conversion events — 2026-11-10

`js/meta-events.js` loads before shared analytics on all public pages. Plausible events remain independent. Meta receives only these explicit conversions, in addition to its existing PageView:

| Meta event | Trigger | Parameters |
| --- | --- | --- |
| `ViewContent` | Product page load | Fixed book ID, name, product type |
| `InitiateCheckout` | Checkout contact/shipping modal opens | Fixed book metadata, initial quantity; no estimated value |
| `Lead` | Existing successful Email Signup or Newsletter Signup hook | Signup group only; accepted subscription, not a guarantee of a brand-new subscriber |
| `QuizCompleted` | Quiz results are displayed | No answers, name, or result tree |
| `GuideDownload` | Drawing-guide download click | Fixed guide name and `download_click`; does not confirm file saved |
| `Purchase` | Return to `/exito`, followed by successful backend verification with Wompi | Actual paid value in COP (including shipping), quantity, fixed book metadata, opaque stable event ID |

### Required deployment setting

Set **`WOMPI_PRIVATE_KEY`** to the production `prv_prod_…` key in the hosting provider's secret/environment settings and redeploy. Do not put this key in HTML, JavaScript, git, chat, or a URL. No Meta access token is needed for this browser-pixel implementation.

The existing production integrity secret signs a checkout receipt valid for seven days. The browser stores that receipt in sessionStorage. The server uses the private key to query Wompi and checks transaction ID, reference, amount, currency, and APPROVED status against the signed receipt. It returns only conversion metadata, never the Wompi customer record. Sandbox checkout does not receive a production receipt. Missing configuration, mismatches, declined payments and verification failures never emit Purchase. Wompi's current transaction lookup requires a private key: https://docs.wompi.co/en/docs/colombia/seguimiento-de-transacciones/

An approved widget callback saves the transaction ID before redirecting. Wompi's direct redirect can also supply `id`. Success-page verification retries pending/server-error responses five times, five seconds apart. Reloading can retry later. Browser localStorage remembers up to 100 purchase event IDs; the same stable ID is also sent to Meta for deduplication. Storage failures cannot break checkout, but can reduce tracking coverage/deduplication. Clearing storage, switching devices, closing the return page, delayed approvals after the retry window, or tracker blocking can prevent reliable browser attribution. This is not Conversions API delivery; purchases without a return visit need a future webhook/CAPI implementation.

Custom conversion setup in Meta remains an account action: after receiving `QuizCompleted` and `GuideDownload`, create custom conversions using those event names. Use Purchase for sales campaigns and Lead for signup campaigns, and include conversion value/ROAS in purchase reporting. Avoid adding duplicate URL/button rules for these already-instrumented actions. Select the correct dataset and make it available to the ad account.

### Verification

Run `npm test` on the Node version in `.nvmrc`. The conversion tests cover event mapping, personal-data exclusion, local/test suppression, redirect recovery, reload deduplication, invalid receipts, payment mismatches, missing credentials, and non-approved payments. Validate the deployed Purchase event with an actual approved production transaction only after configuring the private key; do not fabricate a Purchase to make it appear in Events Manager.
