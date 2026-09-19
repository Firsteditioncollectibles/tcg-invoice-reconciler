# V1 handover checkpoint — 19 September 2026

Status: implemented and verified locally and in GitHub Actions on `feat/tcgplayer-reconciler-v1`; standalone Vercel deployment is staged but not submitted.
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

## Environment notes

The usual Playwright browser download timed out here. A Chromium binary obtained from the published `@sparticuz/chromium` npm package was used through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. That temporary binary and dependency are not part of the application or its committed dependency set. Agent-browser could not start its daemon in this environment; Playwright performed browser verification instead. CI installs its own standard Playwright Chromium.

## Remaining boundary

- No deployment has been submitted yet. The user explicitly approved creating a separate Vercel project through the dashboard. Vercel sign-in succeeded.
- Vercel connector deployment is unavailable. The dashboard Git import could not access the repository; automatic approval review blocked initiating a GitHub connection because its access scope was not visible. No additional GitHub access was granted.
- Direct folder upload succeeded with the tracked files from application commit `5e38e62e7bfb4e4c9dced62b364bb1b122f0f842`. The pending form shows Next.js, project name `tcg-invoice-reconciler`, and team `ryan1993cook-2810's projects` (`team_5DQoS9LZQGvYBVK00CtKwcPJ`). This path requires no Git integration or secrets.
- Deployment is paused at Vercel's optional "Secure Your Account with 2FA" dialog. Automatic approval review blocked clicking "Skip securing my account" because the user had not explicitly authorized declining the 2FA setup prompt. Ask for that specific permission; do not bypass the rejection.
- No genuine customer receipt was available. Test representative real TCGplayer screenshots/packing slips next, then adjust the parser for any demonstrated layout gaps. Do not claim universal OCR accuracy.
- Keep V1 scope explicit: one order per import, USD, English OCR, supported Latin PDF text; see README.md.
- A separate deployment must use only this repository and its own project/resources. No CardScout resource was accessed or reused.

## Continue from here

1. Keep this V1 branch as the single source of the build; inspect remote HEAD before adding work.
2. Reproduce any real-receipt parsing failures with anonymized fixtures and test the fix before proceeding.
3. After the account prompt is resolved, submit the staged standalone deployment and verify the live import/edit/export workflow. Record its actual URL and project ID. Keep deployment protection enabled; never reuse a project, database or credentials from CardScout.
4. Retain the buyer-prepared / not seller-issued disclosure in all export paths.
