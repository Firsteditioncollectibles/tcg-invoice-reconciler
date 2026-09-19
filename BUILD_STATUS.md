# V1 handover checkpoint — 19 September 2026

Status: implemented and locally verified on `feat/tcgplayer-reconciler-v1`.
Base: `d0eca588ee45744d6e7ac6a6eb4ef6b780edbd45` on `main`.

## Completed

- Replaced the initial nonfunctional upload and print-only editor with a complete browser workflow.
- PNG/JPEG/WebP OCR, native PDF text extraction, scanned-PDF OCR fallback and page/size limits.
- OCR/PDF words aligned by visual position so descriptions remain attached to their own price columns.
- Order/date/seller/recipient/address/line-item extraction, with source comparison, raw text and review warnings.
- Editable descriptions, condition, seller, quantities, prices, fixed shipping/tax/discount, line addition/deletion and undo.
- Exact-duplicate consolidation that preserves value and respects card/condition/seller/price boundaries.
- Integer-cent totals and validation; invalid values never silently become zero.
- Reviewed-row state and final confirmation; meaningful edits reset confirmation.
- JSON draft download/reopen, unsaved-changes warning, cancellation and failure recovery.
- Direct PDF download with embedded fonts, repeat table headings, long-order pagination and buyer-prepared disclosure on every page.
- Responsive editor, source pane and document preview.
- Reproducible dependencies, same-origin scanner assets and CI workflow; no API keys or database.

## Latest completed validation

- `npm run typecheck`: passed.
- `npm test`: **14/14 passed**.
- `npm run build`: passed; app prerenders successfully.
- `npm run test:e2e`: **7/7 passed**, using an isolated Chromium browser (19.8 seconds).
- E2E includes actual file upload/extraction/export for a text PDF, PNG screenshot and scanned PDF, plus the edit/consolidate/delete/totals/draft workflow, mobile overflow check, corrupted input, cancel during OCR initialization and missing scanner assets.
- Browser extraction tests observed no requests to external origins.
- Visual review: desktop/mobile editor and one-/six-page PDFs inspected. PDF text extraction confirmed one footer disclosure per page, repeat headings and text within page margins.
- Evidence: `docs/evidence/`. All test documents/screenshots contain synthetic data only.

## Environment notes

The usual Playwright browser download timed out here. A Chromium binary obtained from the published `@sparticuz/chromium` npm package was used through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. That temporary binary and dependency are not part of the application or its committed dependency set. Agent-browser could not start its daemon in this environment; Playwright performed browser verification instead. CI installs its own standard Playwright Chromium.

## Remaining boundary

- No live hosting/deployment was configured or changed in this build. The repository contained only the starter application and no dedicated hosting configuration. The app runs with the commands in README.md.
- No genuine customer receipt was available. Test representative real TCGplayer screenshots/packing slips next, then adjust the parser for any demonstrated layout gaps. Do not claim universal OCR accuracy.
- Keep V1 scope explicit: one order per import, USD, English OCR, supported Latin PDF text; see README.md.
- A separate deployment must use only this repository and its own project/resources. No CardScout resource was accessed or reused.

## Continue from here

1. Keep this V1 branch as the single source of the build; inspect remote HEAD before adding work.
2. Reproduce any real-receipt parsing failures with anonymized fixtures and test the fix before proceeding.
3. For a live test URL, provision or use a verified standalone hosting project linked only to this repository; never reuse a project, database or credentials from CardScout.
4. Retain the buyer-prepared / not seller-issued disclosure in all export paths.
