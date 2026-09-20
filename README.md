# TCG Invoice Reconciler

A standalone, TCGplayer-focused tool for turning an order screenshot or PDF into an editable **buyer-prepared reconciled shipment document**.

Live V1: https://tcg-invoice-reconciler.vercel.app/

The separate Vercel project was deployed from the tested source files. It is not connected to GitHub auto-deployments; see `BUILD_STATUS.md` for the deployed application commit and verified project ID.

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
2. Your order opens as an editable document matching the marketplace boxes. Click a box to edit the order date/number, ship-to/bill-to addresses, seller/tracking, or a card cell. Compare the original/source text with the extracted order and line items. All imported rows begin unreviewed. Warnings identify missing metadata, inferred quantities, unsupported currency, low OCR confidence and source-total discrepancies.
3. Edit card descriptions, set/card numbers, rarity, condition, seller, quantity and unit price. Delete missing items, add rows, undo edits, or consolidate exact duplicates. Consolidation requires matching description, set, rarity, details, seller and price; it preserves quantities and cents.
4. Review shipping, tax and discount. They are fixed editable amounts; the app does not infer tax rules or recalculate a tax rate. Totals use integer cents throughout.
5. Mark reviewed rows, confirm the order details and charges, then download the PDF. The PDF starts directly with the order boxes and uses embedded fonts, wrapped rows, repeated table headings and page numbers. Reconciliation is identified in the app, download filename, PDF metadata and total label. The large title and repeated disclaimer blocks were removed at the user's request. It is **not a newly seller-issued invoice**.
6. Download a JSON draft before closing. Reopen it with **Open draft** to continue. Drafts preserve editable data and extracted text, but do not embed the original image/PDF. Unsaved edits trigger a browser leave warning where supported.

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

- Unit tests: decimal arithmetic, invalid quantities, discounts, consolidation boundaries, parsing, extraction warnings, PDF text reading order, draft validation and PDF export/pagination.
- Browser tests: actual PDF, PNG OCR and scanned-PDF uploads; editing and deletion; consolidation; exact totals; invalid input; source review; PDF download; draft round-trip; desktop/mobile layout; cancellation; corrupted files; missing OCR assets; and same-origin-only extraction requests.
- All fixtures are synthetic. They are not real buyer/seller transactions. `scripts/make-test-fixtures.py` regenerates them using ReportLab and Poppler if required.

## Scope and limitations

- One TCGplayer order per import. Multiple detected order numbers are flagged; separate those documents before export.
- USD and English OCR for V1. PDF output supports English/Latin accented text; unsupported glyphs produce an explicit error instead of a corrupted PDF.
- The parser supports tabular receipts/packing slips, wrapped descriptions, price/quantity/total columns and stacked product blocks. OCR and layout interpretation are fallible: every extracted order needs visual review. Unusual seller layouts, cropped columns and tiny/blurred screenshots may need text correction or manual rows.
- The automated suite covers both packing slips and marketplace grids using synthetic fixtures. One real customer marketplace screenshot was also verified privately; original customer records are never committed. Other layouts still need source review.
- No automatic sending, cloud storage, supplier-issued invoice generation, deployment integration or background processing is included.

## Isolation

This repository is independent of CardScout. It has no CardScout code, environment variables, services, database, Vercel linkage or Supabase integration. Do not introduce any shared connection to that project. See `BUILD_STATUS.md` for the latest handover checkpoint.
