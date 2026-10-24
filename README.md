# BuildQuote implementation plan

BuildQuote is currently a Vite/React frontend prototype. Keep the existing quotation editor, totals, research surface, and workspace; extend them incrementally rather than creating a separate application.

## Revised development order

1. **Basic quotation workflow and calculations** — Keep project details, editable sections and line items, and deterministic totals as the foundation.
2. **PDF generation** — Replace the current browser print action with a real PDF generated from saved quotation data, including multi-page table flow.
3. **AI change previews and revision history** — Build structured proposals against the current quotation, validate and authorize them on the server, require approval, and persist before/after totals and field-level snapshots. Provide restore/undo without reverting unrelated edits.
4. **SerpApi price evidence and source snapshots** — Add a server-side search service, preserve retrieved evidence and limitations, and keep package prices distinct from normalized quotation rates. Use clearly labelled development fixtures only when credentials are unavailable.
5. **Budget, Standard, and Premium alternatives** — Clone the current scope into independently editable options. Do not infer comparable totals from package listings without reliable coverage and quantity data; retain explicit confirmation requirements.
6. **Persistence, testing, and UI polish** — Move browser-only prototype storage to authenticated server persistence, add focused calculation/revision/evidence/option tests, and validate responsive and accessible workflows.
7. **Subscription payments** — Select a provider after evaluating supported Ghanaian payment methods, then implement verified, idempotent server-side payment processing and plan access.

## Current implementation status

- **Stage 1 — Basic quotation workflow and calculations: implemented and verified.** Contractors can create a blank quotation, edit project details and work sections, add/remove line items, duplicate/reorder sections, and see line, section, subtotal, tax, and grand totals. Drafts can be saved locally even when incomplete; validation explains what must be completed before the quote is ready.
- Saved quotations now drive the dashboard and saved-quotation list. Contractors can reopen, duplicate, and delete local drafts; navigation warns before discarding unsaved quote edits. Mixed-currency dashboard values are grouped by currency rather than added together.
- Calculation and validation helpers are in `src/quoteCalculations.js`, with focused tests in `src/quoteCalculations.test.js`. Run them with `npm test`.
- Local browser storage is still prototype persistence: it is limited to the current browser and is not account-synced or backed by an authenticated server/database.
- PDF action currently opens the browser print dialog; a PDF-generation library and saved-data PDF pipeline are still required.
- Revision previews, change approval/rejection, revision records, restore controls, source snapshots, and three proposal options are implemented as local React workflows and stored in browser `localStorage`.
- Material research records and product comparisons are development samples, not live SerpApi results. Retrieval timestamps, unit-price normalization, evidence labels, and supplier/source limitations are now shown explicitly so the app distinguishes unverified listings from contractor-checked prices.
- Stage 6 is focused on hardening prototype persistence and validating reusable evidence/calculation helpers under test so later server work is introduced without regressing the quotation workflow.
- No API server, authentication, database, Gemma/Ollama connection, SerpApi service, PDF library, or payment provider is configured. Browser-side validation is not a substitute for server authorization or validation.

Stage 1 validation completed with `npm test`, `npm run lint`, `npm run build`, and a browser check of incomplete-draft feedback, totals, section duplication/reordering, save/reload/reopen, and the unsaved-changes prompt.
