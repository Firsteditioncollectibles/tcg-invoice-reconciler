"use client";
import { useEffect, useRef, useState } from "react";
import {
  consolidate,
  DISCLOSURE,
  emptyInvoice,
  editDocumentField,
  readDraft,
  totals,
  type Invoice,
  type LineItem,
} from "../lib/invoice";
import { parseOrder } from "../lib/parser";
import { extractFile } from "../lib/extract";
import DocumentEditor from "./document-editor";
import PdfPreview from "./pdf-preview";
import { pdfFileName, draftFileName } from "../lib/filenames";

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
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [dirty, setDirty] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const draftInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const t = totals(doc);
  const canExport = t.valid && doc.items.length > 0 && !!doc.orderNumber.trim();
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
    setPreview(null);
    setDirty(true);
    setError("");
  }
  function field(key: keyof Invoice, value: string) {
    change(editDocumentField(doc, key, value));
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
    setDirty(true);
    setError("");
    setPreview(null);
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
      const next = parseOrder(result.text, file.name, result.layout);
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
  async function exportPdf(showPreview = false) {
    if (!canExport) return;
    setError("");
    setBusy(true);
    setProgress("Preparing your reconciled PDF…");
    try {
      const { createReconciledPdf } = await import("../lib/pdf");
      const bytes =
        preview ??
        new Uint8Array((await createReconciledPdf(doc)).output("arraybuffer"));
      if (showPreview) {
        setPreview(bytes);
        setNotice("Preview ready. This is the PDF that will be downloaded.");
      } else {
        download(
          new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }),
          pdfFileName(doc.orderNumber, doc.seller),
        );
        setNotice(
          "Reconciled PDF downloaded. Save a draft too if you want to reopen the editable order.",
        );
      }
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
      draftFileName(doc.orderNumber, doc.seller),
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
          <span className="version">V1.1 · TCGplayer</span>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">FROM ORDER TO RECEIVED CONTENTS</p>
            <h1>Your order. Reconciled.</h1>
            <p className="lead">
              Upload your TCGplayer order, edit the boxes on your document, and
              download the reconciled PDF.
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
            <DocumentEditor
              doc={doc}
              busy={busy}
              canUndo={!!history.length}
              field={field}
              row={row}
              change={change}
              undo={() => {
                const last = history.at(-1);
                if (last) {
                  setDoc(last);
                  setHistory((h) => h.slice(0, -1));
                  setPreview(null);
                  setDirty(true);
                }
              }}
              merge={() => {
                const merged = consolidate(doc.items);
                if (merged.length === doc.items.length) {
                  setNotice(
                    "No matching duplicates. Item, set, rarity, condition, seller and price must match.",
                  );
                  return;
                }
                change({ ...doc, items: merged });
                setNotice(
                  `${doc.items.length - merged.length} duplicate line(s) consolidated. Quantities and value preserved.`,
                );
              }}
            />
            <div className="source-review">
              {doc.warnings.length > 0 && (
                <section className="panel review-notes">
                  <h3>Extraction checks</h3>
                  <ul>
                    {doc.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                  <p>Compare these with the original before downloading.</p>
                </section>
              )}
              <details className="panel original-toggle">
                <summary>
                  Compare with original · {doc.sourceName || "Manual draft"}
                </summary>
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
              </details>
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
                <p className="helper">
                  Saves as {pdfFileName(doc.orderNumber, doc.seller)}
                </p>
                {!canExport && (
                  <p className="helper">
                    {!doc.orderNumber.trim() ? "Enter the order number. " : ""}
                    {!t.valid
                      ? "Correct the highlighted item details or amounts."
                      : ""}
                  </p>
                )}
              </div>
              <div className="export-actions">
                <button
                  className="secondary"
                  disabled={busy || !canExport}
                  onClick={() =>
                    preview ? setPreview(null) : void exportPdf(true)
                  }
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
            {preview && <PdfPreview bytes={preview} />}
          </>
        ) : (
          <section className="empty-state">
            <span aria-hidden="true">▤</span>
            <h2>A clean document, from the cards in hand.</h2>
            <p>
              Your order will appear as an editable document. Click any box to
              change its details. Remove missing items and check totals before
              exporting.
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
