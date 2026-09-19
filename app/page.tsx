"use client";
import { useEffect, useRef, useState } from "react";
import {
  cents,
  consolidate,
  DISCLOSURE,
  emptyInvoice,
  money,
  readDraft,
  totals,
  type Invoice,
  type LineItem,
} from "../lib/invoice";
import { parseOrder } from "../lib/parser";
import { extractFile } from "../lib/extract";

const SAMPLE = `TCGplayer\nOrder Number: SAMPLE-123456\nOrder Date: September 19, 2026\nSeller: Example Cards\nShip To:\nSample Buyer\n123 Example Road\nExample City, EX 12345\nQuantity Description Price Total\n2 Pikachu 025/165 Near Mint $1.25 $2.50\n1 Charizard ex 199/165 Near Mint Holofoil $10.00 $10.00\n1 Pikachu 025/165 Near Mint $1.25 $1.25\nSubtotal: $13.75\nShipping: $1.99\nSales Tax: $0.80\nOrder Total: $16.54`;
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Home() {
  const [doc, setDoc] = useState<Invoice>(emptyInvoice);
  const [history, setHistory] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [source, setSource] = useState<{ url: string; type: string } | null>(
    null,
  );
  const [paste, setPaste] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const draftInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const t = totals(doc);
  const unreviewed = doc.items.filter((i) => !i.reviewed).length;
  const canExport =
    t.valid &&
    doc.items.length > 0 &&
    !!doc.orderNumber.trim() &&
    !unreviewed &&
    confirmed;
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  function change(next: Invoice) {
    setHistory((h) => [...h.slice(-29), doc]);
    setDoc(next);
    setConfirmed(false);
    setDirty(true);
    setError("");
  }
  function field(key: keyof Invoice, value: string) {
    change({ ...doc, [key]: value });
  }
  function row(id: string, key: keyof LineItem, value: string | boolean) {
    change({
      ...doc,
      items: doc.items.map((i) =>
        i.id === id
          ? {
              ...i,
              [key]: value,
              ...(key === "reviewed" ? {} : { reviewed: false }),
            }
          : i,
      ),
    });
  }
  function replace(next: Invoice) {
    setHistory([]);
    setDoc(next);
    setConfirmed(false);
    setDirty(true);
    setError("");
    setPreview(false);
    setPaste(next.sourceText);
  }
  function mayReplace() {
    return (
      !doc.items.length ||
      window.confirm(
        "Replace this order? Save a draft first if you want to keep your current edits.",
      )
    );
  }
  async function importFile(file: File) {
    if (!mayReplace()) return;
    setBusy(true);
    setError("");
    setNotice("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const result = await extractFile(file, setProgress, controller.signal);
      if (controller.signal.aborted) return;
      const next = parseOrder(result.text, file.name);
      next.warnings.push(...result.warnings);
      replace(next);
      setSource({
        url: URL.createObjectURL(file),
        type: /\.pdf$/i.test(file.name) ? "application/pdf" : file.type,
      });
      setNotice(
        `${result.method} complete · ${result.pages} page(s) · ${next.items.length} lines found. Review the extraction below.`,
      );
    } catch (e) {
      if (controller.signal.aborted)
        setNotice("Import cancelled. Your previous order is unchanged.");
      else
        setError(
          e instanceof Error
            ? e.message
            : "Could not read this file. Try another screenshot or PDF.",
        );
    } finally {
      if (abort.current === controller) {
        setBusy(false);
        setProgress("");
        abort.current = null;
      }
    }
  }
  function pasteImport() {
    if (!paste.trim()) {
      setError("Paste order text first.");
      return;
    }
    if (!mayReplace()) return;
    replace(parseOrder(paste));
    setSource(null);
    setNotice("Text extracted. Review the order details and each line item.");
  }
  async function exportPdf() {
    setError("");
    setBusy(true);
    setProgress("Preparing your reconciled PDF…");
    try {
      const { createReconciledPdf, pdfFileName } = await import("../lib/pdf");
      const pdf = await createReconciledPdf(doc);
      download(pdf.output("blob"), pdfFileName(doc.orderNumber));
      setNotice(
        "Reconciled PDF downloaded. Save a draft too if you want to reopen the editable order.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "PDF export failed. Your edits are still here.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  function saveDraft() {
    download(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
      `tcg-reconciler-${doc.orderNumber.replace(/[^a-zA-Z0-9_-]/g, "-") || "draft"}.json`,
    );
    setDirty(false);
    setNotice("Editable draft downloaded. Use Open draft to resume later.");
  }
  async function loadDraft(file: File) {
    try {
      if (file.size > 2_000_000)
        throw new Error("Draft is too large (maximum 2 MB).");
      const next = readDraft(await file.text());
      if (!mayReplace()) return;
      replace(next);
      setSource(null);
      setNotice("Draft reopened. Confirm the document before exporting.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the draft.");
    }
  }
  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            FE<span>1</span>
          </span>
          <div>
            <strong>First Edition</strong>
            <span>INVOICE RECONCILER</span>
          </div>
        </div>
        <div className="header-right">
          <span className="private">
            <i />
            Processed on your device
          </span>
          <span className="version">V1 · TCGplayer</span>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">FROM ORDER TO RECEIVED CONTENTS</p>
            <h1>Your order. Reconciled.</h1>
            <p className="lead">
              Scan your TCGplayer order, match what arrived, and export a clear
              shipment document.
            </p>
          </div>
          <div className="top-actions">
            <button
              className="secondary"
              onClick={() => draftInput.current?.click()}
              disabled={busy}
            >
              Open draft
            </button>
            <button
              className="secondary"
              disabled={!doc.items.length || busy}
              onClick={saveDraft}
            >
              Save draft
            </button>
          </div>
        </div>
        <ol className="steps">
          <li className={!doc.items.length ? "active" : "done"}>
            <span>01</span> Import your order
          </li>
          <li className={doc.items.length && !canExport ? "active" : ""}>
            <span>02</span> Review & reconcile
          </li>
          <li className={canExport ? "active" : ""}>
            <span>03</span> Export PDF
          </li>
        </ol>
        <input
          ref={draftInput}
          className="sr-only"
          type="file"
          accept=".json,application/json"
          aria-label="Open saved draft"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void loadDraft(f);
          }}
        />
        <div aria-live="polite" className="messages">
          {error && (
            <div role="alert" className="message error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="message success">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {busy && (
            <div className="message progress">
              <span className="spinner" />
              {progress}
              {abort.current && (
                <button
                  className="text-button"
                  onClick={() => abort.current?.abort()}
                >
                  Cancel import
                </button>
              )}
            </div>
          )}
        </div>
        <section className="import-panel panel" aria-labelledby="import-title">
          <div className="section-top">
            <div>
              <p className="eyebrow">01 / IMPORT</p>
              <h2 id="import-title">Start with the original order</h2>
            </div>
            <span className="tag">PDF · PNG · JPG · WEBP</span>
          </div>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy && e.dataTransfer.files[0])
                void importFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="upload-icon" aria-hidden="true">
              ↑
            </div>
            <div>
              <strong>Drop a screenshot or PDF here</strong>
              <p>
                Up to 20 MB or 20 PDF pages. Your file stays in this browser.
              </p>
            </div>
            <button disabled={busy} onClick={() => upload.current?.click()}>
              Choose file
            </button>
            <input
              className="sr-only"
              ref={upload}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              aria-label="Upload TCGplayer screenshot or PDF"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importFile(f);
              }}
            />
          </div>
          <div className="import-alternatives">
            <details>
              <summary>Paste order text instead</summary>
              <label className="field">
                <span>TCGplayer order text</span>
                <textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={7}
                  placeholder="Paste the order details, line items and totals…"
                />
              </label>
              <button disabled={busy} onClick={pasteImport}>
                Extract pasted text
              </button>
            </details>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                if (mayReplace()) {
                  replace(parseOrder(SAMPLE, "Synthetic example order"));
                  setSource(null);
                  setNotice("Example loaded. This is synthetic test data.");
                }
              }}
            >
              Try an example ↗
            </button>
          </div>
        </section>
        {doc.items.length > 0 || doc.sourceText ? (
          <>
            <div className="workspace">
              <section className="editor panel" aria-labelledby="review-title">
                <div className="section-top">
                  <div>
                    <p className="eyebrow">02 / REVIEW & RECONCILE</p>
                    <h2 id="review-title">Match what arrived</h2>
                  </div>
                  <button
                    className="secondary small"
                    disabled={!history.length || busy}
                    onClick={() => {
                      const last = history.at(-1);
                      if (last) {
                        setDoc(last);
                        setHistory((h) => h.slice(0, -1));
                        setConfirmed(false);
                        setDirty(true);
                      }
                    }}
                  >
                    Undo
                  </button>
                </div>
                <fieldset disabled={busy}>
                  <legend className="sr-only">Order information</legend>
                  <div className="metadata-grid">
                    <label className="field">
                      <span>
                        Order number <b>*</b>
                      </span>
                      <input
                        value={doc.orderNumber}
                        onChange={(e) => field("orderNumber", e.target.value)}
                        placeholder="TCGplayer order number"
                        maxLength={100}
                      />
                    </label>
                    <label className="field">
                      <span>Order date</span>
                      <input
                        value={doc.orderDate}
                        onChange={(e) => field("orderDate", e.target.value)}
                        placeholder="As shown on the original"
                        maxLength={100}
                      />
                    </label>
                    <label className="field">
                      <span>Seller / store</span>
                      <input
                        value={doc.seller}
                        onChange={(e) => field("seller", e.target.value)}
                        maxLength={200}
                      />
                    </label>
                    <label className="field">
                      <span>Recipient</span>
                      <input
                        value={doc.recipient}
                        onChange={(e) => field("recipient", e.target.value)}
                        maxLength={200}
                      />
                    </label>
                    <label className="field">
                      <span>Delivery address</span>
                      <textarea
                        value={doc.address}
                        onChange={(e) => field("address", e.target.value)}
                        rows={3}
                        maxLength={800}
                      />
                    </label>
                    <label className="field">
                      <span>Shipment / package reference</span>
                      <input
                        value={doc.reference}
                        onChange={(e) => field("reference", e.target.value)}
                        placeholder="Optional package or suite reference"
                        maxLength={200}
                      />
                    </label>
                  </div>
                  <div className="line-toolbar">
                    <h3>
                      Line items{" "}
                      <span className="count">{doc.items.length}</span>
                    </h3>
                    <div>
                      <button
                        className="secondary small"
                        onClick={() => {
                          const merged = consolidate(doc.items);
                          if (merged.length === doc.items.length) {
                            setNotice(
                              "No matching duplicates. Description, condition, seller and unit price must all match.",
                            );
                            return;
                          }
                          change({ ...doc, items: merged });
                          setNotice(
                            `${doc.items.length - merged.length} duplicate line(s) consolidated. Quantities and value preserved.`,
                          );
                        }}
                      >
                        Consolidate duplicates
                      </button>
                      <button
                        className="secondary small"
                        onClick={() =>
                          change({
                            ...doc,
                            items: [
                              ...doc.items,
                              {
                                id: crypto.randomUUID(),
                                description: "",
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
                  <p className="helper">
                    Edit quantities and prices, remove missing cards, then mark
                    each line reviewed.
                  </p>
                  <div className="line-labels" aria-hidden="true">
                    <span>DESCRIPTION / CONDITION</span>
                    <span>QTY</span>
                    <span>UNIT PRICE</span>
                    <span>TOTAL</span>
                    <span />
                  </div>
                  <div className="line-list">
                    {doc.items.map((item, index) => (
                      <article
                        className={`line-item ${item.reviewed ? "reviewed" : ""}`}
                        key={item.id}
                        aria-label={`Line ${index + 1}`}
                      >
                        <div className="line-fields">
                          <div className="description-fields">
                            <input
                              aria-label={`Description line ${index + 1}`}
                              value={item.description}
                              onChange={(e) =>
                                row(item.id, "description", e.target.value)
                              }
                              placeholder="Card name, set and number"
                              maxLength={500}
                            />
                            <input
                              aria-label={`Condition and details line ${index + 1}`}
                              value={item.details}
                              onChange={(e) =>
                                row(item.id, "details", e.target.value)
                              }
                              placeholder="Condition / finish / edition"
                              maxLength={300}
                            />
                            <input
                              aria-label={`Seller line ${index + 1}`}
                              value={item.seller}
                              onChange={(e) =>
                                row(item.id, "seller", e.target.value)
                              }
                              placeholder="Seller"
                              maxLength={200}
                            />
                          </div>
                          <label className="compact-field">
                            <span>Qty</span>
                            <input
                              aria-label={`Quantity line ${index + 1}`}
                              inputMode="numeric"
                              value={item.quantity}
                              onChange={(e) =>
                                row(item.id, "quantity", e.target.value)
                              }
                              maxLength={5}
                            />
                          </label>
                          <label className="compact-field">
                            <span>Unit price $</span>
                            <input
                              aria-label={`Unit price line ${index + 1}`}
                              inputMode="decimal"
                              value={item.unitPrice}
                              onChange={(e) =>
                                row(item.id, "unitPrice", e.target.value)
                              }
                              maxLength={12}
                            />
                          </label>
                          <span className="line-total">
                            {cents(item.unitPrice) !== null &&
                            /^\d+$/.test(item.quantity)
                              ? money(
                                  cents(item.unitPrice)! *
                                    Number(item.quantity),
                                )
                              : "—"}
                          </span>
                          <button
                            className="delete"
                            aria-label={`Delete line ${index + 1}`}
                            onClick={() =>
                              change({
                                ...doc,
                                items: doc.items.filter(
                                  (i) => i.id !== item.id,
                                ),
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                        <div className="row-review">
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
                          {item.sourceText && (
                            <details>
                              <summary>Extracted source</summary>
                              <pre>{item.sourceText}</pre>
                            </details>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="review-all">
                    <span>
                      {unreviewed
                        ? `${unreviewed} line${unreviewed === 1 ? "" : "s"} to review`
                        : "All lines reviewed"}
                    </span>
                    <button
                      className="text-button"
                      disabled={!unreviewed}
                      onClick={() =>
                        change({
                          ...doc,
                          items: doc.items.map((i) => ({
                            ...i,
                            reviewed: true,
                          })),
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
                      placeholder="For example: removed one card that was missing from the package."
                      rows={3}
                      maxLength={3000}
                    />
                  </label>
                </fieldset>
              </section>
              <aside className="side-column">
                <section className="panel totals-panel">
                  <p className="eyebrow">RECONCILED AMOUNTS</p>
                  <h2>
                    Order summary <span className="tag">USD</span>
                  </h2>
                  <dl>
                    <div>
                      <dt>Cards received</dt>
                      <dd>{t.count}</dd>
                    </div>
                    <div>
                      <dt>Item subtotal</dt>
                      <dd>{t.valid ? money(t.subtotal) : "—"}</dd>
                    </div>
                  </dl>
                  <fieldset disabled={busy}>
                    <legend className="sr-only">Order charges</legend>
                    {(["shipping", "tax", "discount"] as const).map((key) => (
                      <label className="charge" key={key}>
                        <span>
                          {key[0].toUpperCase() + key.slice(1)}{" "}
                          {key === "discount" ? "−" : "+"}
                        </span>
                        <span className="money-input">
                          <span>$</span>
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
                  </fieldset>
                  <p className="helper">
                    Shipping, tax and discount are fixed amounts. Review them
                    after changing the cards.
                  </p>
                  <div className="grand-total">
                    <span>Reconciled total</span>
                    <strong data-testid="grand-total">
                      {t.valid ? money(t.total) : "Check amounts"}
                    </strong>
                  </div>
                  {doc.sourceTotal !== null && (
                    <p className="source-comparison">
                      Printed order total{" "}
                      <strong>{money(doc.sourceTotal)}</strong>
                      {t.valid && doc.sourceTotal !== t.total && (
                        <span>
                          Difference:{" "}
                          {t.total - doc.sourceTotal < 0 ? "−" : "+"}
                          {money(Math.abs(t.total - doc.sourceTotal))}
                        </span>
                      )}
                    </p>
                  )}
                </section>
                {doc.warnings.length > 0 && (
                  <section className="panel review-notes">
                    <h3>Extraction checks</h3>
                    <ul>
                      {doc.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    <p>
                      These describe the original extraction. Resolve them
                      against the source before confirming below.
                    </p>
                  </section>
                )}
                <section className="panel source-panel">
                  <h3>Source document</h3>
                  <p className="filename">{doc.sourceName || "Manual draft"}</p>
                  {source &&
                    (source.type === "application/pdf" ? (
                      <iframe title="Original uploaded PDF" src={source.url} />
                    ) : (
                      <img
                        alt="Original uploaded TCGplayer order"
                        src={source.url}
                      />
                    ))}
                  <details>
                    <summary>View extracted text</summary>
                    <pre>{doc.sourceText || "No source text saved."}</pre>
                  </details>
                </section>
              </aside>
            </div>
            {!t.valid && (
              <div className="message error" role="alert">
                <ul>
                  {t.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <section
              className="panel export-panel"
              aria-labelledby="export-title"
            >
              <div>
                <p className="eyebrow">03 / EXPORT</p>
                <h2 id="export-title">Ready for your shipment</h2>
                <p>{DISCLOSURE}</p>
                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={
                      busy || unreviewed > 0 || !t.valid || !doc.items.length
                    }
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    I checked the order details, received items and charges
                    against the source.
                  </span>
                </label>
                {!canExport && (
                  <p className="helper">
                    {!doc.orderNumber.trim() ? "Enter the order number. " : ""}
                    {unreviewed
                      ? `Review ${unreviewed} remaining line(s). `
                      : ""}
                    {!confirmed
                      ? "Confirm the document to enable PDF export."
                      : ""}
                  </p>
                )}
              </div>
              <div className="export-actions">
                <button
                  className="secondary"
                  disabled={busy || !doc.items.length}
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "Hide preview" : "Preview document"}
                </button>
                <button
                  disabled={busy || !canExport}
                  onClick={() => void exportPdf()}
                >
                  Download reconciled PDF ↓
                </button>
              </div>
            </section>
            {preview && (
              <section
                className="document-preview"
                aria-label="Reconciled document preview"
              >
                <div className="document-heading">
                  <h2>TCGplayer order</h2>
                  <strong>RECONCILED SHIPMENT DOCUMENT</strong>
                  <p>{DISCLOSURE}</p>
                </div>
                <div className="preview-metadata">
                  <p>
                    <strong>Order:</strong> {doc.orderNumber}
                    <br />
                    <strong>Date:</strong> {doc.orderDate}
                    <br />
                    <strong>Seller:</strong> {doc.seller}
                  </p>
                  <p>
                    <strong>Recipient:</strong> {doc.recipient}
                    <br />
                    {doc.address}
                    <br />
                    <strong>Package:</strong> {doc.reference}
                  </p>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Qty</th>
                      <th>Description / condition</th>
                      <th>Unit price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.quantity}</td>
                        <td>
                          {i.description}
                          <small>
                            {i.details}
                            {i.seller ? ` · ${i.seller}` : ""}
                          </small>
                        </td>
                        <td>
                          {cents(i.unitPrice) !== null
                            ? money(cents(i.unitPrice)!)
                            : "—"}
                        </td>
                        <td>
                          {cents(i.unitPrice) !== null
                            ? money(cents(i.unitPrice)! * Number(i.quantity))
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="preview-totals">
                  <div>
                    <dt>Item subtotal</dt>
                    <dd>{money(t.subtotal)}</dd>
                  </div>
                  <div>
                    <dt>Shipping</dt>
                    <dd>{money(t.shipping ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Tax</dt>
                    <dd>{money(t.tax ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Discount</dt>
                    <dd>−{money(t.discount ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Reconciled total (USD)</dt>
                    <dd>{t.valid ? money(t.total) : "Invalid amounts"}</dd>
                  </div>
                </dl>
                {doc.notes && <p className="preview-notes">{doc.notes}</p>}
              </section>
            )}
          </>
        ) : (
          <section className="empty-state">
            <span aria-hidden="true">▤</span>
            <h2>A clean document, from the cards in hand.</h2>
            <p>
              Your extracted order will appear here. You can edit every line,
              consolidate duplicates, and check the totals before exporting.
            </p>
          </section>
        )}
        <footer className="app-footer">
          <span>First Edition Collectibles · Invoice Reconciler</span>
          <span>Save a draft before closing to keep your edits.</span>
        </footer>
      </main>
    </>
  );
}
