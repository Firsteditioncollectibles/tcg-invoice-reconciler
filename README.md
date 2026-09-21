# TCG Invoice Reconciler

A standalone, TCGplayer-focused tool for turning an order screenshot or PDF into an editable **buyer-prepared reconciled shipment document**.

Live V1.1: https://tcg-invoice-reconciler.vercel.app/

The dedicated Vercel project is connected only to this repository. Production deployments track `feat/tcgplayer-reconciler-v1`; `main` is still the starter branch. See `BUILD_STATUS.md` for the verified project, tested application commit and publishing checkpoint.

## Run

Use Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Production: `npm run build && npm start`.

No API key, database, login or environment variables are needed. OCR workers, English language data, PDF workers and fonts are copied from the locked npm dependencies into `public/vendor` by `predev` / `prebuild`. Do not omit development dependencies during the build, because the OCR language data is a build dependency. Generated vendor files are not committed.

## V1 workflow

1. Choose a TCGplayer screenshot (PNG/JPG/WebP) or PDF, or paste copied order text. Maximum 20 MB, 20 PDF pages, 40 megapixels per image. PDF pages with usable text are extracted directly; scanned pages go through English OCR.
2. Your order opens as an editable document matching the supplied marketplace screenshot. Click the text in place to edit the order date/number, channel, ship-to/bill-to addresses, seller/tracking, tax label or a card cell. Editing/deletion controls sit outside the exported document. Compare the original/source text with the extracted order and line items. Warnings identify missing metadata, unreadable prices or quantities, inferred quantities, unsupported currency, low OCR confidence and source-total discrepancies. An unreadable marketplace price stays blank in its own row instead of dropping the card. PDFs with selectable summaries and scanned card tables still run OCR.
3. Edit card descriptions, set/card numbers, rarity, condition, seller, quantity and unit price. Delete missing items, add rows, undo edits, or consolidate exact duplicates. Consolidation requires matching description, set, rarity, details, seller and price; it preserves quantities and cents. Changing the order seller updates matching row sellers; individually different sellers stay separate.
4. Review shipping, tax and discount. They are fixed editable amounts; the app does not infer tax rules or recalculate a tax rate. Totals use integer cents throughout.
5. Check the extracted information, make any edits, then preview or download directly without review checkboxes. Missing order numbers, descriptions and invalid amounts still block export automatically. PDFs are named from **Shipped and sold by**, such as `Sample Card House.pdf`; drafts use `Sample Card House.json`. Blank seller names fall back to the order number. The preview displays the actual PDF with previous/next page controls. Edits and undo clear the old preview. The editable sheet and PDF share one measured layout: source-style header buttons, four unboxed metadata columns, standard small Pokémon card backs, blue item names, alternating rows and original column widths. Long orders paginate with repeated headings; longer edits wrap and expand their sections. Page size follows the document proportions. The header buttons reproduce the source appearance and do not send messages or open seller actions. Reconciliation is identified in the app and PDF metadata. Extra titles, disclaimer blocks, duplicate totals and printed page numbers are omitted at the user's explicit request. It is **not a newly seller-issued invoice**.
6. Download a JSON draft before closing. Reopen it with **Open draft** to continue. Drafts preserve editable data, extracted text and the small card-thumbnail crops, but do not embed the full original image/PDF. Unsaved edits trigger a browser leave warning where supported.

Files are processed in the browser and are not uploaded to an OCR API or application backend. Fonts and OCR software are served from this app's origin. The scanner can be cancelled; failed imports leave the current document intact.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when a compatible local Chromium binary is already available. E2E tests start their own isolated local dev server on port 3148. Do not run a separate dev server for this same checkout at the same time.

- Unit tests: decimal arithmetic, invalid quantities, discounts, consolidation boundaries, parsing, extraction warnings, PDF text reading order, draft validation, neighbouring-column OCR drift, small punctuation, PDF export/pagination and exported coordinates against the supplied screenshot.
- Browser tests: native, scanned and mixed text/image PDF uploads plus PNG OCR; every editable metadata/card field; editing, addition and deletion; consolidation; exact totals; invalid input; actual PDF preview and page navigation; stale-preview invalidation; PDF text verification; draft round-trip; desktop/mobile layout; cancellation; corrupted files; missing OCR assets/fonts and retry; and same-origin-only extraction requests.
- GitHub Actions runs typecheck, unit/PDF tests, production build and the browser suite on branch pushes and pull requests. Failed browser checks retain screenshots and traces; synthetic PDF downloads and reports are uploaded as seven-day CI artifacts. No customer records are included.
- All fixtures are synthetic. They are not real buyer/seller transactions. `scripts/make-test-fixtures.py` regenerates them using ReportLab and Poppler if required.

## Scope and limitations

- One TCGplayer order per import. Multiple detected order numbers are flagged; separate those documents before export.
- USD and English OCR for V1. PDF output supports English/Latin accented text; unsupported glyphs produce an explicit error instead of a corrupted PDF.
- The parser supports tabular receipts/packing slips, wrapped descriptions, price/quantity/total columns and stacked product blocks. OCR and layout interpretation are fallible: every extracted order needs visual review. Unusual seller layouts, cropped columns and tiny/blurred screenshots may need text correction or manual rows.
- The automated suite covers both packing slips and marketplace grids using synthetic fixtures. The supplied marketplace screenshot and a scanned PDF made from it were also verified privately through editing every field, export and draft reopening; original customer records are never committed. Other layouts and ambiguous OCR characters still need source review.
- No automatic sending, cloud storage, supplier-issued invoice generation, deployment integration or background processing is included.

## Isolation

This repository is independent of CardScout. It has no CardScout code, environment variables, services, database, Vercel linkage or Supabase integration. Do not introduce any shared connection to that project. See `BUILD_STATUS.md` for the latest handover checkpoint.
