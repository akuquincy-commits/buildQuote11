# BuildQuote — Unified Master Project Prompt

## Role and working agreement

Act as a senior full-stack engineer, AI integration engineer, UI/UX designer, and technical mentor. Help me build BuildQuote: a functional, responsive construction quotation, material research, and proposal platform for contractors and artisans, initially serving Ghana.

This is a product intended for real users, not just a frontend demonstration. I am learning full-stack development while building it. Work with me incrementally, keep the application runnable, and explain the purpose of each stage and important architectural decisions.

### How to work

- Begin each stage by inspecting the existing workspace and the relevant implementation. Preserve working code and adapt the current architecture rather than rebuilding features that already work.
- State the goal and scope of the stage, identify relevant files and dependencies, then implement a small complete increment.
- Give precise file paths and commands. Test the stage before moving on and explain the result.
- Do not dump or generate the entire application in one response. Do not advance to a later stage until the current stage is working, unless a genuine dependency requires it; explain any change in order.
- Do not invent credentials or claim an external integration was tested when it was not. Make errors and missing services visible; preserve the user's work if a service is unavailable.
- Prefer free or low-cost development tools. Explain infrastructure costs and get approval before deploying paid infrastructure.
- Ask only for information genuinely required to continue.

## Product objective

Build a polished SaaS application with these connected capabilities:

1. Turn project requirements and work items into structured, professional quotations with optional AI assistance.
2. Let a contractor converse with AI about an existing quotation, inspect structured change proposals, and explicitly approve or reject them.
3. Research construction materials using server-side SerpApi search and preserve source-based price evidence.
4. Calculate financial totals deterministically and produce client-ready PDF quotations based on saved quotation data.
5. Create Budget, Standard, and Premium alternatives without reducing essential agreed scope or inventing prices.
6. Offer configurable subscription plans and, after the core product is complete, securely process payments using a provider suitable for Ghana.

Use Ghanaian cedis (GH₵ / GHS) by default, while allowing the architecture to support other currencies.

## Existing application and change constraints

The workspace currently contains a Vite + React frontend prototype. Reuse the existing React quotation editor, calculations, research surface, and workspace. Extend them incrementally; do not create a separate application or duplicate working features.

The current UI includes local prototype workflows for quotation editing, calculations, revision previews, price evidence, comparisons, and three quote options. These are not production integrations. There is currently no configured authenticated API, database, Gemma/Ollama connection, SerpApi service, or PDF-generation library. Browser `localStorage` and client-side validation are development-only and do not satisfy server-side persistence, access control, or validation.

Do not present sample research data as live search results. Development fixtures must be clearly labelled and excluded from production use. Do not claim the PDF is complete until a real PDF is generated from saved quotation data.

## Brand and design direction

Use the supplied BuildQuote UI reference image as design inspiration, not as a reason to create nonfunctional screens.

- Product: **BuildQuote**
- Tagline: **Better Quotes. Bigger Projects.**
- Primary blue: `#2563EB`
- Deep navy: `#0F172A`
- Background: `#F8FAFC`
- Cards: white
- Typography: Inter or a similar modern sans-serif

Maintain a professional white/light-grey workspace, deep navy desktop sidebar, royal-blue primary actions, rounded cards, subtle borders and restrained shadows, clear typography, generous spacing, consistent icons and responsive desktop/tablet/mobile layouts.

## Application experiences and screens

### Public website

Provide a landing page with Home, Features, How It Works, Pricing, Login, and Get Started navigation; a clear value proposition and calls to action; AI quotation, research and PDF feature highlights; a simple workflow; configurable pricing plans; and footer links for contact, terms, and privacy. Use realistic construction visuals when appropriate, but do not let the landing page delay core workflow delivery.

### Authenticated application

Provide a persistent desktop sidebar for:

- Dashboard
- New Quotation
- My Quotations
- Material Research
- AI Assistant
- Subscription & Billing
- Business Settings
- Help

Use a compact/mobile navigation pattern on small screens. Include useful profile controls, notifications where appropriate, loading/error/empty states, validation feedback, and confirmation for consequential actions.

### Dashboard

Show actual persisted application data for total quotations, total quotation value, pending client responses, completed quotations, and recent quotations with status/date/client/amount. Include quick actions for creating a quote, researching materials, viewing saved quotes, and managing settings. A new account should see a useful empty state and a clear first-quotation action. Do not leave permanent hardcoded statistics in a production dashboard.

### Required screen set

1. Public landing page
2. Login and registration
3. Dashboard
4. Quotation creation: project details and work sections
5. Quotation editor with details, items, AI Assistant, notes, preview, and alternatives
6. Quotation-specific AI chat and revision history
7. Material research and product comparison
8. Quotation preview and PDF export
9. Saved quotations
10. Pricing and subscription plans
11. Subscription and billing management
12. Business settings
13. Useful loading, empty, error, and confirmation states

Prioritize the screens required to complete the quotation workflow. Avoid pages that do not support the core product.

## Quotation workflow

### Project details

Collect and validate:

- Client/company name and optional contact information
- Project title, location, and description
- Contractor business information
- Currency
- Configurable applicable tax rate
- Payment terms
- Quotation validity period

Never imply that a default tax rate is legally correct for every project; encourage the contractor to verify applicable rules.

### Sections and line items

Allow the user to create, edit, duplicate, reorder, and remove work sections. Suggested section types include Painting, Tiling, Doors and Fittings, Kitchen, Electrical, Plumbing, Roofing, Labour, and Other Works.

Each section contains editable line items with description, quantity, unit, unit price, optional labour and material costs, line total, and notes. Support units such as square metres, metres, pieces, bags, litres, hours, packages, and lump sums. Allow manual entry of all prices and quantities. AI-suggested quantities/rates are always unconfirmed and must never be presented as verified measurements or prices.

### Review and editing

Provide a quotation review interface with clear sections, line items, prices, subtotals, tax, and grand total. Users must be able to edit AI-generated content manually. Keep the quote visible while editing or chatting where practical, especially on desktop; on mobile use a dedicated tab or expandable panel.

## Deterministic calculations and quotation integrity

All financial arithmetic must be performed by deterministic application logic, never by Gemma. Implement and test:

- Line totals and section subtotals
- Overall subtotal
- Applicable taxes
- Discounts if supported
- Grand total
- Currency formatting

Define whether tax is applied before or after discounts. Avoid duplicate tax calculations and rounding errors; use decimal-safe arithmetic or an appropriate money library when needed. Validate AI-proposed values before applying them and recalculate totals after approval with the same calculation functions.

For every material rate, distinguish its basis: sourced listing, contractor-entered, estimated, confirmed by contractor, or unverified/unavailable. A search result is not a supplier guarantee and must not be described as independently confirmed.

## AI architecture and quotation editing

Use Gemma as the primary model through Ollama during local development. The Node.js backend calls the local Ollama API. Model use cases include:

- Drafting professional quotation descriptions
- Organizing work into sections
- Asking clarification questions
- Refining an existing quotation through conversation
- Summarizing sourced product information
- Identifying possible omissions

The backend handles calculations, persistence, validation, authorization, and searches. The model has no inherent web access: retrieve relevant SerpApi results explicitly on the server and provide only relevant context. Prefer schema-validated structured responses; treat model output as untrusted. Do not silently fall back to an unrelated closed model. If Ollama is unavailable, explain the issue and preserve user work. Keep model, search, and payment services behind replaceable server-side interfaces.

### AI chat after proposal creation

The AI Assistant is a required, quotation-specific capability. Support requests such as:

- Rewrite a description professionally
- Add/remove a section or item
- Change a unit price or quantity
- Compare material alternatives
- Explain why totals changed
- Review missing information
- Improve proposal formatting or summarize it for the client

When product research is relevant, show matching product options, available evidence, source links, retrieval times, and limitations. Explain what the evidence does and does not support.

### Structured change preview and revision history

Every proposed quotation modification must be a validated structured change against the current quote, not a regenerated full quotation and not an immediate overwrite.

Before applying a proposal, show:

- Affected section and line item
- Each changed field, previous value, and proposed value
- Reason for the proposal
- Estimated financial impact and proposed total, calculated by deterministic application code
- Any material source evidence and limitations relevant to the proposal

Provide explicit **Apply Changes** and **Reject Changes** actions. Apply only the validated fields after approval; preserve unrelated sections and all user-entered values. Rejecting must retain the proposal in chat history without modifying the quote.

On the server, validate each proposed change and verify that the quotation belongs to the authenticated user before applying it. Never treat client-side validation as authorization.

Record significant applied changes using simple snapshots/revision records, not collaborative version control. Each revision should preserve quotation ID, user request, timestamp, changed fields, previous and new values, totals before and after, and sufficient before/after quote data to support restoration. Let the contractor inspect revisions and undo/restore previous values where feasible without reverting unrelated later edits. Preserve chat history per quotation.

## Material research and price evidence

Use a dedicated Material Research page and integrate research into quotation editing. Search for paint, cement, tiles, roofing materials, doors/fittings, plumbing fixtures, electrical supplies, and other construction products. Offer category, brand, and relevant specification filters where data supports them.

For each result, show and preserve only available source information:

- Product name and brand
- Listed price and currency
- Package size/unit when available
- Supplier/site name when identifiable
- Image when available
- Specifications when available
- Product/source URL
- Retrieval timestamp
- Availability only if explicitly present in the retrieved source
- Known limitations and unavailable fields

Never fabricate supplier names, product facts, specifications, prices, availability, certification, or inventory. Search snippets are not guaranteed supplier quotes. Label missing, estimated, unverified, or unavailable information and encourage users to confirm price and availability directly with suppliers. Do not call a product “best quality” solely because its rating or price is higher.

Allow side-by-side comparison of a small number of relevant products. Calculate price per unit only when package size and measurement unit can be reliably normalized; otherwise show it as unavailable. Any simple package arithmetic must be labelled as such and must not be confused with a normalized project rate.

When a sourced product is added to a quote, save a snapshot of the product/source evidence with the quotation item. Later web changes must not silently change the quote. Allow the contractor to mark a price as independently checked, recording the confirmation date; appearing in search results alone never confirms a price.

Keep the SerpApi key server-side in an environment variable. If credentials are unavailable, use clearly labelled mock data only in development and tests, never as live production search.

## Budget, Standard, and Premium alternatives

Add a **Create Three Options** action to quotation review. Generate three independent editable versions from the existing quote:

- **Budget:** prioritize lower-cost suitable material alternatives while preserving the essential agreed work.
- **Standard:** balance cost, available specifications, and contractor-stated requirements.
- **Premium:** offer higher-specification or higher-cost alternatives only when product information supports the comparison.

These are purchasing-option labels, not guaranteed quality rankings.

Each option must preserve essential project requirements and have its own editable line items and deterministically calculated totals. Compare:

- Total quotation value
- Material selections
- Scope of work
- Labour assumptions
- Important differences
- Exclusions and assumptions
- Product sources
- Information needing confirmation

Allow the contractor to select an option, edit it, and continue through the normal review and PDF export workflow. Do not change the original quote or another option when editing one alternative.

Do not invent prices to fill a comparison. If a sourced alternative, reliable package conversion, or coverage quantity is missing, preserve the current contractor rate and mark the item/total as requiring confirmation or request a contractor-entered price. Do not reduce quantities, remove essential work, or change safety-related specifications to create a cheaper option. Clearly distinguish confirmed-rate totals from estimates and sourced-but-unverified evidence.

Keep the first implementation simple: start from one quotation and a small number of available or manually entered material alternatives. Do not attempt fully automated construction cost optimization in the MVP.

## PDF output

Provide Save, Preview, and Generate PDF actions. Generate a professional downloadable PDF from saved quotation data, not AI prose or AI-generated totals. Include:

- Contractor name, branding, and contact details
- Client details
- Quotation number, issue date, and validity date
- Project title and location
- Itemized sections, quantities, units, and unit rates
- Section subtotals
- Subtotal, applicable tax, discounts if supported, and grand total
- Payment terms
- Notes, exclusions, and assumptions
- Acceptance/signature fields

Use a reliable PDF-generation library and verify long tables flow across pages correctly. When exporting an alternative, export the selected option’s quote snapshot and calculations.

## Persistence, saved quotations, and accounts

Users must be able to save, reopen, edit, duplicate, and delete quotations. Support Draft, Ready for Review, Sent, Accepted, Rejected, and Expired statuses. Store quotation data, line items, price-evidence snapshots, important AI changes/revisions, option versions, and associated chat history in persistent storage. Use SQLite for straightforward local development unless the existing architecture makes another choice compelling.

Do not claim an email was sent or a client accepted a quote unless those actions are implemented and confirmed. Check ownership for every quotation, revision, evidence snapshot, chat, and billing record.

Implement authentication and authorization before exposing private data. If using passwords, store them securely. Include input validation on client and server, rate limits on AI/search endpoints, safe rendering of user/model text, appropriate source URL handling, useful error feedback, and environment-variable configuration. Do not send unnecessary client personal information to AI or search providers. Include an `.env.example` without real secrets and document external dependencies and limitations.

## Subscription and payments

Provide a Free plan and configurable paid plans. The following are provisional examples, not finalized pricing:

- **Free:** limited quotation creation, basic templates, manual editing/PDF export, limited AI or research.
- **Pro:** higher quote limits, conversational editing, more research, branding, saved history, and productivity features.
- **Business:** higher usage limits and team/business features only where implemented.

Keep prices, entitlements, and usage limits configurable, not scattered through the UI. Do not disable essential quotation editing just to showcase payments.

The billing architecture should account for plan comparison, upgrade/downgrade, subscription status, billing history, usage limits, renewal, cancellation, and plan-based access control.

Before selecting a provider, evaluate actual Ghana support, supported transaction/payment methods, recurring billing capabilities, fees, and terms. Do not assume card or mobile-money recurring support. If automatic recurring payment is not available for a chosen method, use an appropriate supported alternative such as manual renewal.

Never store raw card details or trust a frontend success message. Verify payments server-side and/or through verified webhooks. Make webhook handling idempotent; handle pending, failed, cancelled, and successful states. Grant premium access only after confirmed payment or verified active subscription. Keep secrets in environment variables and test in sandbox mode. If live credentials are unavailable, implement a clearly labelled integration boundary/test mode; never represent a simulated payment as collected money.

## Recommended technology

Use unless workspace inspection reveals a compelling reason to adapt:

- Frontend: React + Vite
- Styling: Tailwind CSS compatible with existing styles (or retain current styling if migration adds no value)
- Routing: React Router
- Backend: Node.js + Express
- AI: Gemma through Ollama
- Web search: SerpApi
- Database: SQLite for MVP
- PDF generation: suitable JavaScript PDF library
- Payments: provider verified as suitable for intended Ghanaian flows
- Validation: schema-validation library
- Version control: Git and GitHub

Keep frontend/backend responsibilities clear. Keep API keys and sensitive operations on the backend. Reuse current calculation helpers and UI patterns rather than duplicating behavior. Add dependencies only when the selected stage requires them.

## Revised stage-by-stage development order

Work in this order. At the beginning of each stage, inspect current code and existing behavior. Explain the scope, dependencies, and acceptance checks before implementation. Complete and test one stage at a time.

### Stage 1 — Inspect workspace and complete basic quotation workflow/calculations

Inspect the existing project, scripts, routing, styling, data model, and current quote editor. Confirm which parts are reusable. Complete the core project details, editable sections and items, validation, deterministic calculations, tax policy, and a reliable local draft workflow. Identify production-only work separately. Do not overwrite the working frontend.

### Stage 2 — Real PDF generation

Replace any print-dialog-only placeholder with a real PDF generated from quotation data. Support client/contractor details, itemization, totals, terms, assumptions, signature fields, pagination, and the selected quote option. Test totals and long-table page flow.

### Stage 3 — AI change previews and revision history

Connect Gemma/Ollama through the backend when ready. Build schema-validated structured proposals against the current quote; add approval/rejection, server-side validation and ownership checks, deterministic recalculation, persistent revision snapshots, chat history, and restore/undo. Preserve unrelated values. Do not apply changes without approval.

### Stage 4 — SerpApi price evidence and source snapshots

Build server-side material search with protected credentials. Add source-aware result cards, filters, comparisons, safe package-price normalization, retrieval dates, limitations, contractor confirmation, and evidence snapshots on quote items. Clearly label dev fixtures if credentials are not configured.

### Stage 5 — Budget, Standard, and Premium alternatives

Generate independent options from an existing quote and only supported/manual alternatives. Show scoped comparisons, calculated totals, price basis, sources, assumptions, and confirmation needs. Preserve essential scope and labour unless the contractor explicitly approves a change. Allow selection, editing, review, and PDF output for an option.

### Stage 6 — Persistence, testing, and UI polish

Move prototype browser storage into authenticated server persistence with SQLite (or the justified chosen database). Complete account/ownership handling, quote CRUD/statuses, revisions, chat, evidence, and options. Add focused tests for calculations, validation, ownership, change approval/rejection and restore, evidence snapshots/price status, option isolation/scope/totals, and PDF output. Finish responsive/accessibility work and useful loading, empty, error, and confirmation states.

### Stage 7 — Subscription payments

Evaluate a suitable Ghana payment provider and supported flows before selection. Implement configurable plans, usage/entitlement checks, billing state, server-side payment verification, idempotent webhooks, sandbox/test workflow, and only then document live configuration.

Reorder only when a real dependency requires it, and explain the reason before a major change.

## Acceptance criteria

The MVP is complete when a user can:

1. Navigate the public site and authenticated application screens.
2. Create, edit, save, reopen, duplicate, and delete a construction quotation.
3. Add/edit/remove/reorder sections and line items and manually enter prices/quantities.
4. Generate or refine a draft with Gemma and see missing information or assumptions clearly labelled.
5. Chat with AI after a quote exists and see a structured change preview before approval.
6. Reject a proposal without changing the quote; approve a valid one and see correct deterministic totals.
7. Inspect revisions, including requests, timestamps, changed fields, previous/new values and totals before/after, then restore values without overwriting unrelated changes.
8. Search real products through server-side SerpApi when configured; otherwise see only clearly labelled development fixtures.
9. Inspect source links, retrieval information, limitations, and available prices/specifications without fabricated facts.
10. Compare products, add one to a quotation with an immutable evidence snapshot, and record independent contractor confirmation separately from source retrieval.
11. Create Budget, Standard, and Premium alternatives with editable, independent line items; compare totals, material selections, scope, labour, assumptions and evidence; avoid invented prices or silent scope reductions.
12. Recalculate totals correctly after edits and approved changes.
13. Preview and download a professional PDF generated from the saved quote or selected option.
14. View plans and, when configured, complete a sandbox payment flow where premium access depends on verified server billing state.

Add automated tests for calculations, input validation, quotation ownership and changes, revisions and restore, evidence status/snapshots, option isolation and totals, PDF output, and payment-state handling where practical.

Document installation, environment variables, frontend/backend start commands, tests, Ollama/Gemma setup, SerpApi credentials, PDF behavior, payment sandbox, and remaining service limitations. Never place real credentials in documentation.

## Immediate instruction

**Begin with Stage 1 only.** Inspect the existing workspace and report what is already implemented, what is missing, the proposed architecture, required dependencies, and the first small implementation steps. Do not create every screen or backend module at once. Proceed with Stage 1 after that inspection and keep the app runnable.
