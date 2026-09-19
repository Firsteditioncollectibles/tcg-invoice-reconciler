# V1 handover checkpoint — 19 September 2026

Status: V1 is live at https://tcg-invoice-reconciler.vercel.app/ and verified locally, in GitHub Actions, and on the hosted deployment. Code remains on `feat/tcgplayer-reconciler-v1`.
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
- GitHub Actions run `35465279832` passed all checks on application commit `5e38e62e7bfb4e4c9dced62b364bb1b122f0f842`. Draft PR: https://github.com/Firsteditioncollectibles/tcg-invoice-reconciler/pull/1.
- Hosted smoke tests: synthetic PNG screenshot OCR, native PDF extraction and scanned-PDF OCR each extracted Pikachu 025/165, quantity 2, and the correct $16.54 order total.
- Hosted editing/export: consolidation produced quantity 3 without changing $16.54; deleting the other card produced $6.54; quantity/price/discount edits produced $2.98. Export was disabled until review. The downloaded one-page PDF contained $2.98, omitted the deleted card and retained the buyer-prepared / not seller-issued disclosure. Its rendered layout was visually checked. Evidence: `docs/evidence/reconciled-live-smoke.pdf`.

## Standalone deployment

- Live URL: https://tcg-invoice-reconciler.vercel.app/
- Vercel project: `tcg-invoice-reconciler`, ID `prj_biGutj7uN6aGN7BhHovBjUz7Gkzs`.
- Team: `ryan1993cook-2810's projects`, ID `team_5DQoS9LZQGvYBVK00CtKwcPJ`.
- Deployment: `dpl_8PWZnVyGJvfbryhnLyXzZBWhurXQ`, READY, production, source `drop`, Next.js, Node 24.x.
- Deployed application files: commit `5e38e62e7bfb4e4c9dced62b364bb1b122f0f842`, uploaded directly through the dashboard. Subsequent documentation/evidence commits do not change the hosted app.
- No GitHub integration, secrets or database were added. Branch pushes do not deploy automatically. Future deployments must use this existing verified project rather than create another project or use unrelated resources.
- Vercel's default deployment protection remains enabled. The production URL above was opened successfully and used for all hosted smoke tests.
- The user authorized creating this project and subsequently said "yes always skip that" about the optional Vercel 2FA onboarding prompt. That prompt was skipped; no further confirmation is needed to skip the same optional prompt.

## Environment notes

The usual Playwright browser download timed out here. A Chromium binary obtained from the published `@sparticuz/chromium` npm package was used through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. That temporary binary and dependency are not part of the application or its committed dependency set. Agent-browser could not start its daemon in this environment; Playwright performed browser verification instead. CI installs its own standard Playwright Chromium.

## Remaining boundary

- Vercel connector deployment and build-log methods returned "Tool not found"; project/deployment metadata reads worked. The dashboard's direct folder upload completed successfully. The Git import path had an unapproved GitHub access-scope change, so no GitHub connection was established.
- No genuine customer receipt was available. Test representative real TCGplayer screenshots/packing slips next, then adjust the parser for any demonstrated layout gaps. Do not claim universal OCR accuracy.
- Keep V1 scope explicit: one order per import, USD, English OCR, supported Latin PDF text; see README.md.
- This deployment uses only this repository and its own project/resources. No CardScout resource was accessed or reused.

## Continue from here

1. Keep this V1 branch as the single source of the build; inspect remote HEAD before adding work.
2. Reproduce any real-receipt parsing failures with anonymized fixtures and test the fix before proceeding.
3. For further application changes, rerun the affected checks and deploy to the verified existing reconciler project. Keep deployment protection enabled and verify the live workflow after redeploying.
4. Retain the buyer-prepared / not seller-issued disclosure in all export paths.
