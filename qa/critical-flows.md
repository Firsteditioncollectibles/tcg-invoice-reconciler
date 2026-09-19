# Critical QA Flows

These flows define the minimum behaviour required before the TCG Invoice Reconciler can be treated as release-ready.

## QA-001 — Application health
- App loads successfully.
- No uncaught page errors.
- No unexpected browser console errors.
- Import, reconcile, and output sections are visible.

## QA-002 — TCGplayer file intake
Current automated coverage:
- PDF can be selected without the app crashing.

Required when scanner extraction is implemented:
- Upload a known TCGplayer screenshot.
- Upload a known TCGplayer PDF.
- Extract order identifier and available order metadata.
- Extract every visible line item.
- Preserve description, condition/details, quantity, and monetary values.
- Surface low-confidence or unreadable fields instead of silently inventing values.

## QA-003 — Editable reconciliation
- Description can be edited.
- Details can be edited.
- Price can be edited.
- Quantity can be edited.
- Deleting a line item removes it.
- Adding a line item creates a usable row.
- Duplicate/consolidation behaviour must be tested when implemented.

## QA-004 — Totals
- Subtotal equals the sum of price × quantity for all retained rows.
- Editing price recalculates subtotal.
- Editing quantity recalculates subtotal.
- Deleting a row recalculates subtotal.
- Adding a row recalculates subtotal.

## QA-005 — Reconciled output
Current automated coverage:
- Output control is present.
- Reconciled-document disclaimer is visible.

Required when export is implemented:
- Export produces an openable PDF.
- Exported values match the edited document state.
- Deleted items do not appear.
- Consolidated rows appear exactly once.
- Totals in the PDF match the editor.
- Output must be labelled as a reconciled shipment/document record and must not represent itself as a newly seller-issued invoice.

## QA-006 — Regression rule
Every confirmed production or preview bug must gain a permanent automated regression test before the fix is considered complete.
