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
