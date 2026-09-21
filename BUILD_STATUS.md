# V1.1 handover checkpoint — 20 September 2026

Status: V1.1 screenshot-matched editing/export is LIVE at https://tcg-invoice-reconciler.vercel.app/. Code remains on `feat/tcgplayer-reconciler-v1`.
Base: `d0eca588ee45744d6e7ac6a6eb4ef6b780edbd45` on `main`.

## Card-back artwork update — 21 September

- User clarified that every product thumbnail should be replaced by a small standard Pokémon card back, preserving the original row layout. Shared editor/PDF drawing now always uses the bundled JPEG, including rows without source artwork and reopened drafts. No runtime external image requests.
- Image source and rights attribution are recorded in `lib/card-back.ts`. No customer data is included.
- Local `npm run check` passed: 23 unit/PDF tests, typecheck, production build. PDF checks exercise replacement of existing source thumbnails; browser checks assert all 13 rows use the same bundled JPEG.
- Local browser checks could not launch because the previous Chromium binary was empty and its package was unavailable. GitHub Actions run **35543346062** passed the full typecheck/unit/build/browser suite on `14e239504eb5a8792623d03a82e1a9365e9bc1b6`. The hosted preview was visually verified: all 13 rows show identical card backs in the editor and actual PDF preview; quantity editing recalculates $75.85 to $73.87. This update supersedes earlier requirements for original card thumbnails.

- On 21 September the user reported the live site still showed original thumbnails. Confirmed the tested change existed only on `feat/pokemon-card-backs`; production still pointed to `73f0925`. Publish the verified app plus this documentation to the already-authorized production branch, and verify READY and the public site before reporting completion. No CardScout resources are involved.

## 20 September publishing — current

- The user approved the repository-only GitHub/Vercel connection and publication. Connected `Firsteditioncollectibles/tcg-invoice-reconciler` to the existing dedicated project `prj_biGutj7uN6aGN7BhHovBjUz7Gkzs` in team `team_5DQoS9LZQGvYBVK00CtKwcPJ`. No new project, environment variables, database or broader repository selection was added.
- Production branch tracking is now `feat/tcgplayer-reconciler-v1`; the dashboard confirmed the setting was saved. Do not deploy the starter `main` branch. Pushes now trigger production builds. Default deployment protection remains unchanged.
- Application commit `d3beae2ac4ad6316171c4c3e8b7233c51ff40056` passed the complete GitHub Actions workflow **35532241046**, including all 23 unit/PDF tests, production build and all 13 browser workflows.
- First Git-connected production deployment succeeded: `dpl_2EqxoLKtL3YJuNL2wWEx8UCv1usz`, commit `a0a5f0073b2508104f9b317c3b25264d45f005b4`, READY, source git, production alias `https://tcg-invoice-reconciler.vercel.app/`, build about 15.4 seconds. The application is identical to `d3beae2`; only handover documentation changed. GitHub Actions **35537616671** passed all checks on the deployment commit. The previous connection blocker in historical entries below is resolved.
- Hosted checks passed with synthetic marketplace screenshot, native-text PDF and scanned PDF: each produced 13 rows and $75.85. The live screenshot editor retained 13 thumbnails. Changing a quantity from 4 to 2 recalculated $73.87; deleting the last row gave $72.12; undo restored $73.87. Billing/name/condition fields were edited in place. Export stayed disabled until review, and the actual PDF preview rendered Page 1 of 1. The live layout was visually inspected.
- Verification limit: the live export action reported a successful download, but Cloud Browser's download-event capture timed out; the downloaded live file was not independently inspected. Actual PDF download/content verification passed in the full local and GitHub browser suites. Do not describe the live downloaded bytes as separately verified. The project runtime-error scan for the preceding hour returned no errors; browser-console errors observed were from the cloud-browser extension, not the app.
- This follow-up changes deployment documentation only. Production tracks this branch, so its push may create another deployment with identical application files; verify READY before handing over.
- The user said this will eventually become part of CardScout. No present integration was authorized or performed; the existing strict isolation boundary remains.

## 20 September exact-layout correction — current

- User explicitly requested the exact supplied marketplace screenshot layout. Replaced the approximate boxed editor and auto-table PDF with one shared measured drawing layout: source header buttons, four unboxed metadata columns, source tax label, blue card names, actual card thumbnails, alternating rows and matching column widths/row spacing. The reviewed 13-row source exports at the same 1436:1632 proportions. Longer edited fields wrap; headers/metadata/rows expand and long orders paginate without cutting rows.
- All order/card text remains editable in place. Delete/review/seller controls sit outside the document; discounts, package reference and notes remain available below it. Summary quantities/subtotal/total stay calculated. Large valid charge amounts fit their summary cells without wrapping digits into a neighbouring amount.
- As requested, no large title/disclaimer blocks, zero-discount line, duplicate bottom total or printed page-number footer are added. The source-style Contact Seller/Rate Transaction buttons are decorative and perform no external action. Reconciliation identity remains in the app, PDF metadata and download filename. Output is not newly seller-issued.
- Screenshot/scanned-PDF and native-PDF imports capture small thumbnail crops locally. Drafts preserve these crops and reject remote image URLs. No source image, real extracted draft, private preview or customer details are committed.
- Visual verification found and fixed OCR boundary drift which copied neighbouring channel/address words into the wrong field. Region selection now uses word centres. Small punctuation stays on its line. A cropped card-text OCR pass avoids artwork being prepended to card names and retains the higher-confidence capitalization when passes agree on letters. The scanned-PDF capitalization regression found during testing was reproduced and corrected.
- Final local `npm run check` passed: typecheck, **23/23 unit/PDF tests**, production build. New PDF assertions read actual exported coordinates against independently measured screenshot positions, and check large shipping/tax amounts. The 13 browser workflows were verified (12 passed on the initial full run; the remaining scanned-PDF workflow passed after the capitalization fix in 14.7s). The full GitHub workflow remains the final gate for this commit.
- **2/2 private supplied-source edit/export/draft workflows passed in 27.3s**. A separate current-screenshot layout/thumbnail test passed in 13.5s: 13 rows, 21 cards, $68.02 subtotal and $75.85 total. Remaining ambiguous country/set-code OCR characters were reviewed and corrected in place against the attachment for the private PDF preview; arbitrary OCR is still review-required.
- Visually inspected the actual-source editor and exported PDF, plus wrapped rows on a long-order PDF. The private matching-layout PDF was made available to the user separately. Existing public evidence PDFs show earlier layouts and are historical; current synthetic exports are retained by CI.
- No deployment occurred. The dedicated reconciler production site is still the old V1. The prior automatic approval rejection for an insufficiently scoped GitHub/Vercel connection is unresolved; do not retry that connection without the requested repository-only authorization. CardScout remains entirely untouched.

## 20 September QA pass — edit every field in the supplied order

- User requested complete debugging and easy editing of every field, using the supplied TCGplayer document as the reference. The available original is a screenshot; a temporary image-only PDF was made from that screenshot for the private scanned-PDF test. Neither original nor derived customer records are committed.
- Reproduced and fixed a missing-price bug: the old marketplace parser returned 12 rows after one of 13 prices was made unreadable. Row grouping now uses printed rarity/condition labels as well as prices, preserving the row with a blank price and blocking export until corrected. Isolated quantity OCR uses those same row boundaries.
- Reproduced and fixed a mixed-PDF bug: a selectable summary plus a scanned card table returned no rows because text length and a money amount suppressed OCR. Native text must now yield a usable item row; otherwise the page is scanned. A runtime-generated synthetic mixed PDF guards this case.
- Editing the order seller updates the matching line sellers and their review state while preserving independently different row sellers. Added a stable accessible name for notes when reopening a saved draft.
- Replaced the approximate HTML preview with a rendered preview of the actual export bytes, including previous/next page controls. Edits, undo and replacement clear the old preview and confirmation. PDF.js receives a copied buffer so preview rendering cannot detach the download data.
- Export checks now read text from the actual downloaded PDFs. Every metadata/card field, row addition/deletion, recalculated charges, retained quantities, per-row sellers, draft reopening, removal of stale content, and absence of the removed title/disclaimer blocks are asserted. PDF preparation failures preserve edits and allow retry. Notes headings stay with their text across page breaks.
- Final validation: `npm run check` passed (typecheck, **19/19 unit/PDF tests**, production build); **13/13 browser workflows passed in 55.9s**; **2/2 private source workflows passed in 26.0s**. Both the screenshot and the scanned PDF extracted 13 lines, 21 cards and $75.85 before edits, then passed the complete field-edit/export/draft round-trip. No runtime page errors were observed in those editing workflows.
- Visually inspected the actual PDF preview and both pages of the synthetic fully edited export. Verified page margins and notes pagination. New evidence: `docs/evidence/all-fields-edited.pdf` (synthetic data). Private regression files remain under ignored `tmp/`.
- React review: scanner/PDF libraries remain dynamically loaded; preview cancellation destroys its loading/render tasks; state invalidation happens in edit actions; controls retain accessible names. GitHub Actions continues to enforce build/unit/browser checks and retain synthetic failure screenshots/traces.
- Prior clean-layout commit `160b2e6894c238ca7d96ff4e3eaba609f9553038` passed GitHub Actions run `35510971108`. This QA update is not deployed. The existing repository-only Vercel connection approval is still unanswered; do not claim the live V1 has these changes.

## 20 September follow-up — clean PDF layout

- The user supplied cropped PDF header/footer screenshots and explicitly said "dont need any of this". Removed the large TCGplayer title, shipment-document subtitle and printed buyer-prepared disclaimer blocks, including the corresponding preview heading. PDFs now begin with order boxes at the normal top margin; continuation pages keep table headings and page numbers.
- Reconciliation remains identified in the app, exported filename, PDF metadata and total label. This user preference supersedes the earlier requirement for printed disclosure blocks; output must still not be represented as newly seller-issued.
- Validation: typecheck and production build passed; **3/3 PDF tests** and **2/2 affected browser workflows (6.6s)** passed. Browser checks included editing/consolidating/deleting, accurate totals, draft reopening, preview, native marketplace PDF import and downloaded PDF export.
- Visually checked the updated one-page synthetic marketplace export and continuation/final pages of a 100-row export. All four long-order pages have text inside the margins, page numbers, and no removed header/disclaimer text. Updated example: `docs/evidence/marketplace-boxes-example.pdf`.
- GitHub Actions run `35510474081` passed for the preceding marketplace-box implementation (`62659ea831cee4dadff22733f34830925cf126f6`).
- This follow-up is not deployed. The user has not yet answered the prior request to connect only this repository to the existing dedicated Vercel project. The upload/tool failures and scoped GitHub authorization blocker below remain unresolved.

## 20 September correction — marketplace order boxes

- The supplied real marketplace screenshot exposed a serious V1 parsing gap: the live parser mixed summary amounts into card rows. Synthetic packing-slip fixtures had not covered the multi-column marketplace layout.
- Added positioned-text parsing for separate summary, shipping, billing and seller/tracking boxes, plus item/details/price/quantity columns. Screenshot and scanned-PDF imports read isolated quantity cells to handle narrow digits and table rules. Unreadable quantities remain blank and block export.
- The primary editor now is the TCGplayer-style document itself. Click boxes to edit order details, addresses, tracking, card names, sets, rarity, condition, price and quantity. Delete/undo/consolidate remain available; calculations use integer cents. Set and rarity are included in consolidation boundaries.
- PDF export follows the same metadata boxes and four-column table, retaining buyer-prepared disclosure. Older saved drafts migrate with empty new fields.
- Validation: typecheck and production build passed; **17/17 unit/PDF tests**, **10/10 browser tests (38.3s)**. Marketplace tests cover native PDF, screenshot and scanned PDF, then in-document edits, undo/deletion, exact totals, PDF export and mobile overflow.
- A separate temporary private browser regression passed against the user's actual attachment: 13 lines, 21 cards, $68.02 subtotal, $1.48 shipping, $6.35 tax, $75.85 total. Changing a four-card row to two recalculates $73.87. The attachment and its extracted personal details are excluded from git.
- Synthetic regression fixtures and script are committed. Evidence: `docs/evidence/marketplace-boxes-editor.png` and `marketplace-boxes-example.pdf`. Export text and rendered one-page layout checked for edited billing/set values, total and disclosure.
- Deployment and hosted verification of this correction remain pending. Vercel's source uploader did not advance after folder selection (including one retry after verifying file synchronization) or file selection. Its MCP deployment method still returns "Tool deploy_to_vercel not found", including after reopening the plugin. No new deployment was submitted.
- The existing project dashboard offers Git connection / CLI deployment. Opening the GitHub connection had previously been blocked by automatic approval review because its access scope was not visible. Ask for permission to connect only this repository to the existing reconciler project; do not grant broader repository access or reuse any other project. The next action should resolve this publishing route, then perform hosted verification.

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
- Direct PDF download with embedded fonts, repeat table headings, long-order pagination and reconciliation metadata; the printed disclosure blocks were removed by explicit user request.
- Responsive editor, source pane and document preview.
- Reproducible dependencies, same-origin scanner assets and CI workflow; no API keys or database.

## Initial V1 validation — 19 September

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

## Original standalone deployment — historical V1

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
- One genuine marketplace screenshot is now verified; other layouts and PDFs still require source review. Do not claim universal OCR accuracy.
- Keep V1 scope explicit: one order per import, USD, English OCR, supported Latin PDF text; see README.md.
- This deployment uses only this repository and its own project/resources. No CardScout resource was accessed or reused.

## Continue from here

1. Keep this V1 branch as the single source of the build; inspect remote HEAD before adding work.
2. Reproduce any real-receipt parsing failures with anonymized fixtures and test the fix before proceeding.
3. For further application changes, rerun the affected checks and deploy to the verified existing reconciler project. Keep deployment protection enabled and verify the live workflow after redeploying.
4. Honor the clean PDF preference above; retain reconciliation identification in the app, filename, PDF metadata. Do not restore the removed title or printed disclaimer blocks.
