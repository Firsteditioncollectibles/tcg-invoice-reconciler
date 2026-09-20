"use client";
import {
  cents,
  money,
  quantity,
  totals,
  DISCLOSURE,
  type Invoice,
  type LineItem,
} from "../lib/invoice";

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
  const t = totals(doc),
    unreviewed = doc.items.filter((i) => !i.reviewed).length;
  const metadata = (
    name: string,
    key: keyof Invoice,
    multiline = false,
    placeholder = "",
  ) => (
    <label className="paper-field">
      <span>{name}</span>
      {multiline ? (
        <textarea
          aria-label={name}
          value={String(doc[key] ?? "")}
          onChange={(e) => field(key, e.target.value)}
          rows={4}
          maxLength={800}
          placeholder={placeholder || name}
        />
      ) : (
        <input
          aria-label={name}
          value={String(doc[key] ?? "")}
          onChange={(e) => field(key, e.target.value)}
          maxLength={200}
          placeholder={placeholder || name}
        />
      )}
    </label>
  );
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
      <fieldset className="order-sheet" disabled={busy}>
        <legend className="sr-only">Editable TCGplayer document</legend>
        <div className="paper-disclosure">
          <strong>TCGplayer order · reconciled copy</strong>
          <span>{DISCLOSURE}</span>
        </div>
        <div className="paper-top">
          {metadata("Order date", "orderDate")}
          {metadata("Channel", "channel", false, "TCG Marketplace")}
          {metadata("Order number *", "orderNumber")}
        </div>
        <div className="paper-boxes">
          <div className="paper-box paper-summary">
            <h3>ORDER SUMMARY</h3>
            <dl>
              <div>
                <dt>Quantity</dt>
                <dd data-testid="card-count">{t.valid ? t.count : "—"}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{t.valid ? money(t.subtotal) : "—"}</dd>
              </div>
            </dl>
            {(["shipping", "tax", "discount"] as const).map((key) => (
              <label className="paper-charge" key={key}>
                <span>
                  {key === "tax"
                    ? "Sales tax"
                    : key === "shipping"
                      ? "Shipping"
                      : "Discount"}
                </span>
                <span className="paper-money">
                  $
                  <input
                    aria-label={key[0].toUpperCase() + key.slice(1)}
                    inputMode="decimal"
                    value={doc[key]}
                    onChange={(e) => field(key, e.target.value)}
                    maxLength={12}
                  />
                </span>
              </label>
            ))}
            <div className="paper-grand">
              <strong>Total</strong>
              <strong data-testid="grand-total">
                {t.valid ? money(t.total) : "Check amounts"}
              </strong>
            </div>
            <p className="helper">
              Review shipping, tax and discount after editing items.
            </p>
            {doc.sourceTotal !== null && (
              <p className="source-comparison">
                Printed total <strong>{money(doc.sourceTotal)}</strong>
                {t.valid && doc.sourceTotal !== t.total && (
                  <span>
                    Difference: {t.total < doc.sourceTotal ? "−" : "+"}
                    {money(Math.abs(t.total - doc.sourceTotal))}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="paper-box">
            <h3>SHIP TO</h3>
            {metadata("Recipient", "recipient")}
            {metadata("Delivery address", "address", true)}
          </div>
          <div className="paper-box">
            <h3>BILL TO</h3>
            {metadata("Billing recipient", "billingRecipient")}
            {metadata("Billing address", "billingAddress", true)}
          </div>
          <div className="paper-box">
            <h3>SHIPPED AND SOLD BY</h3>
            {metadata("Seller / store", "seller")}
            {metadata("Tracking number", "tracking")}
            {metadata("Shipping method", "shippingMethod", true)}
            {metadata("Shipment / package reference", "reference")}
          </div>
        </div>
        <div
          className="paper-table"
          role="table"
          aria-label="Editable line items"
        >
          <div className="paper-table-head" role="row">
            <span role="columnheader">ITEMS</span>
            <span role="columnheader">DETAILS</span>
            <span role="columnheader">PRICE</span>
            <span role="columnheader">QUANTITY</span>
          </div>
          {doc.items.map((item, index) => (
            <div
              className={`paper-line ${item.reviewed ? "is-reviewed" : ""}`}
              role="row"
              aria-label={`Line ${index + 1}`}
              key={item.id}
            >
              <div className="paper-cell paper-item" role="cell">
                <span className="cell-caption">Item</span>
                <textarea
                  aria-label={`Description line ${index + 1}`}
                  value={item.description}
                  onChange={(e) => row(item.id, "description", e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Card name and number"
                />
                <input
                  aria-label={`Set line ${index + 1}`}
                  value={item.setName ?? ""}
                  onChange={(e) => row(item.id, "setName", e.target.value)}
                  maxLength={250}
                  placeholder="Set / collection"
                />
                <div className="paper-row-actions">
                  <label>
                    <input
                      type="checkbox"
                      checked={item.reviewed}
                      onChange={(e) =>
                        row(item.id, "reviewed", e.target.checked)
                      }
                    />
                    {item.reviewed ? "Reviewed" : "Mark reviewed"}
                  </label>
                  <button
                    type="button"
                    className="remove-line"
                    aria-label={`Delete line ${index + 1}`}
                    onClick={() =>
                      change({
                        ...doc,
                        items: doc.items.filter((i) => i.id !== item.id),
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="paper-cell paper-details" role="cell">
                <span className="cell-caption">Details</span>
                <label>
                  <span>Rarity:</span>
                  <input
                    aria-label={`Rarity line ${index + 1}`}
                    value={item.rarity ?? ""}
                    onChange={(e) => row(item.id, "rarity", e.target.value)}
                    maxLength={150}
                    placeholder="Rarity"
                  />
                </label>
                <label>
                  <span>Condition:</span>
                  <input
                    aria-label={`Condition and details line ${index + 1}`}
                    value={item.details}
                    onChange={(e) => row(item.id, "details", e.target.value)}
                    maxLength={300}
                    placeholder="Condition / finish"
                  />
                </label>
                <details className="line-extras">
                  <summary>Seller & extracted text</summary>
                  <input
                    aria-label={`Seller line ${index + 1}`}
                    value={item.seller}
                    onChange={(e) => row(item.id, "seller", e.target.value)}
                    maxLength={200}
                    placeholder="Seller"
                  />
                  <pre>{item.sourceText}</pre>
                </details>
              </div>
              <div className="paper-cell paper-price" role="cell">
                <span className="cell-caption">Price</span>
                <label className="paper-money">
                  $
                  <input
                    aria-label={`Unit price line ${index + 1}`}
                    value={item.unitPrice}
                    inputMode="decimal"
                    onChange={(e) => row(item.id, "unitPrice", e.target.value)}
                    maxLength={12}
                  />
                </label>
              </div>
              <div className="paper-cell paper-quantity" role="cell">
                <span className="cell-caption">Quantity</span>
                <input
                  aria-label={`Quantity line ${index + 1}`}
                  value={item.quantity}
                  inputMode="numeric"
                  onChange={(e) => row(item.id, "quantity", e.target.value)}
                  maxLength={5}
                />
                <small>
                  Line total{" "}
                  {cents(item.unitPrice) !== null &&
                  quantity(item.quantity) !== null
                    ? money(cents(item.unitPrice)! * Number(item.quantity))
                    : "—"}
                </small>
              </div>
            </div>
          ))}
          {!doc.items.length && (
            <p className="paper-empty">
              No rows were extracted. Add a line above, or import a clearer
              source.
            </p>
          )}
        </div>
        <div className="review-all">
          <span>
            {unreviewed
              ? `${unreviewed} lines to review`
              : "All lines reviewed"}
          </span>
          <button
            className="text-button"
            disabled={!unreviewed}
            onClick={() =>
              change({
                ...doc,
                items: doc.items.map((i) => ({ ...i, reviewed: true })),
              })
            }
          >
            I checked every line — mark all reviewed
          </button>
        </div>
        <label className="field notes">
          <span>Reconciliation notes</span>
          <textarea
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
