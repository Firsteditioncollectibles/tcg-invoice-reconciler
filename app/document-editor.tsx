"use client";
import { type Invoice, type LineItem } from "../lib/invoice";
import OrderSheet from "./order-sheet";

type Props = {
  doc: Invoice;
  busy: boolean;
  canUndo: boolean;
  field: (key: keyof Invoice, value: string) => void;
  row: (id: string, key: keyof LineItem, value: string | boolean) => void;
  change: (doc: Invoice) => void;
  undo: () => void;
  merge: () => void;
};
export default function DocumentEditor({
  doc,
  busy,
  canUndo,
  field,
  row,
  change,
  undo,
  merge,
}: Props) {
  return (
    <section className="document-editor" aria-labelledby="review-title">
      <div className="document-toolbar">
        <div>
          <p className="eyebrow">02 / EDIT YOUR DOCUMENT</p>
          <h2 id="review-title">Click a box to edit it.</h2>
          <p className="helper">
            Change the received items directly below. Totals update as you type.
          </p>
        </div>
        <div className="document-tools">
          <button
            className="secondary small"
            disabled={!canUndo || busy}
            onClick={undo}
          >
            Undo
          </button>
          <button className="secondary small" disabled={busy} onClick={merge}>
            Consolidate duplicates
          </button>
          <button
            className="secondary small"
            disabled={busy}
            onClick={() =>
              change({
                ...doc,
                items: [
                  ...doc.items,
                  {
                    id: crypto.randomUUID(),
                    description: "",
                    setName: "",
                    rarity: "",
                    details: "",
                    seller: doc.seller,
                    quantity: "1",
                    unitPrice: "",
                    sourceText: "Manually added",
                    reviewed: false,
                  },
                ],
              })
            }
          >
            + Add line
          </button>
        </div>
      </div>
      <OrderSheet
        doc={doc}
        busy={busy}
        field={field}
        row={row}
        change={change}
      />
      <fieldset className="additional-fields" disabled={busy}>
        <legend>Additional adjustments</legend>
        <label>
          Discount
          <input
            aria-label="Discount"
            inputMode="decimal"
            value={doc.discount}
            onChange={(e) => field("discount", e.target.value)}
          />
        </label>
        <label>
          Shipment / package reference
          <input
            aria-label="Shipment / package reference"
            value={doc.reference}
            onChange={(e) => field("reference", e.target.value)}
          />
        </label>
        <label className="field notes">
          <span>Reconciliation notes</span>
          <textarea
            aria-label="Reconciliation notes"
            value={doc.notes}
            onChange={(e) => field("notes", e.target.value)}
            placeholder="For example: removed one card missing from the package."
            rows={2}
            maxLength={3000}
          />
        </label>
      </fieldset>
    </section>
  );
}
