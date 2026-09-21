import { test } from "node:test";
import assert from "node:assert/strict";
import { createReconciledPdf, pdfFileName } from "../lib/pdf";
import { parseOrder } from "../lib/parser";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { pdfPages } from "./pdf-content";
const fonts = async () => ({
  regular: await readFile(
    "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf",
  ),
  bold: await readFile(
    "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf",
  ),
});
const sample = () => {
  const d = parseOrder(
    "Order #: EXAMPLE-001\nSeller: Example Cards\nQty Description Price Total\n2 Pokémon Pikachu 025/165 Near Mint $1.25 $2.50\nSubtotal $2.50",
  );
  d.items = d.items.map((i) => ({ ...i, reviewed: true }));
  return d;
};
test("PDF retains reconciliation metadata and filename", async () => {
  const d = sample();
  const pdf = await createReconciledPdf(d, await fonts());
  const raw = pdf.output();
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.match(raw, /Buyer-prepared reconciliation/);
  assert.match(raw, /Not a seller-issued invoice/);
  assert.equal(
    pdfFileName("EXAMPLE-001", "Example Cards"),
    "Example Cards.pdf",
  );
  const [text] = await pdfPages(new Uint8Array(pdf.output("arraybuffer")));
  assert.match(text, /EXAMPLE-001/);
  assert.match(text, /\$2.50/);
  assert.doesNotMatch(
    text,
    /Buyer-prepared|Not a seller-issued|TCGplayer order|RECONCILED SHIPMENT DOCUMENT/,
  );
  await mkdir("tmp/pdfs", { recursive: true });
  await writeFile(
    "tmp/pdfs/reconciled-example.pdf",
    new Uint8Array(pdf.output("arraybuffer")),
  );
});
test("long orders paginate with wrapped descriptions", async () => {
  const d = sample();
  d.items = Array.from({ length: 100 }, (_, i) => ({
    ...d.items[0],
    id: String(i),
    description: `Card ${i + 1} - Pokémon long set description 025/165`,
  }));
  const pdf = await createReconciledPdf(d, await fonts());
  assert.ok(pdf.getNumberOfPages() >= 4);
  const pages = await pdfPages(new Uint8Array(pdf.output("arraybuffer")));
  pages.forEach((text) => {
    assert.match(text, /ITEMS DETAILS PRICE QUANTITY/);
    assert.doesNotMatch(text, /Page \d+|Reconciled total/);
    assert.doesNotMatch(
      text,
      /Buyer-prepared|Not a seller-issued|RECONCILED SHIPMENT DOCUMENT/,
    );
  });
  assert.match(pages.at(-1)!, /Card 100/);
  assert.match(pages.at(-1)!, /\$250.00/);
  await mkdir("tmp/pdfs", { recursive: true });
  await writeFile(
    "tmp/pdfs/reconciled-100-lines.pdf",
    new Uint8Array(pdf.output("arraybuffer")),
  );
});
test("export validates required data without review checkboxes", async () => {
  const d = sample();
  await assert.rejects(createReconciledPdf({ ...d, items: [] }));
  const unreviewed = await createReconciledPdf(
    { ...d, items: [{ ...d.items[0], reviewed: false }] },
    await fonts(),
  );
  assert.equal(unreviewed.getNumberOfPages(), 1);
  await assert.rejects(createReconciledPdf({ ...d, orderNumber: " " }));
  await assert.rejects(
    createReconciledPdf({ ...d, items: [{ ...d.items[0], description: " " }] }),
  );
  await assert.rejects(
    createReconciledPdf({ ...d, items: [{ ...d.items[0], quantity: "-1" }] }),
  );
  await assert.rejects(
    createReconciledPdf({ ...d, recipient: "漢字" }, await fonts()),
    /supports English/,
  );
});

test("export keeps the supplied marketplace geometry without added boxes or footer", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const layout = JSON.parse(
    await readFile("tests/fixtures/marketplace-layout.json", "utf8"),
  );
  const d = parseOrder("Synthetic source", "fixture.pdf", [layout]);
  d.items.forEach((i) => {
    i.reviewed = true;
    i.thumbnail =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=";
  });
  d.shippingMethod = "Standard (est.delivery by\nSeptember 28, 2026) - $1.48";
  const exported = await createReconciledPdf(d, await fonts());
  assert.match(exported.output(), /\/Subtype\s*\/Image/);
  const task = getDocument({
    data: new Uint8Array(exported.output("arraybuffer")),
  });
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, 1);
    const p = await pdf.getPage(1);
    const viewport = p.getViewport({ scale: 1436 / p.view[2] });
    assert.ok(Math.abs(viewport.height - 1632) < 1);
    const content = await p.getTextContent();
    const actual = content.items.filter((i) => "str" in i);
    // Coordinates measured independently from the attached marketplace screenshot.
    for (const [label, x, y] of [
      ["ORDER DATE", 28, 52],
      ["CHANNEL", 310, 52],
      ["ORDER NUMBER", 592, 52],
      ["ORDER SUMMARY", 28, 168],
      ["SHIP TO", 374, 168],
      ["BILL TO", 720, 168],
      ["SHIPPED AND SOLD BY", 1066, 168],
      ["ITEMS", 40, 455],
      ["DETAILS", 530, 455],
      ["PRICE", 1034, 455],
      ["QUANTITY", 1221, 455],
      ["Pikachu 025/165", 100, 518],
    ] as const) {
      const run = actual.find((i) => i.str === label);
      assert.ok(run, label);
      const [px, py] = viewport.convertToViewportPoint(
        run.transform[4],
        run.transform[5],
      );
      assert.ok(
        Math.abs(px - x) < 1 && Math.abs(py - y) < 1,
        `${label}: ${px}, ${py}`,
      );
    }
    const text = actual.map((i) => i.str).join(" ");
    assert.match(text, /Contact Seller/);
    assert.match(text, /Rate Transaction/);
    assert.doesNotMatch(
      text,
      /Discount:|Reconciled total|Page \d+|Buyer-prepared/,
    );
  } finally {
    await task.destroy();
  }
});

test("larger shipping and tax amounts remain intact within their summary cells", async () => {
  const d = sample();
  d.shipping = "1234.56";
  d.tax = "9876.54";
  const pdf = await createReconciledPdf(d, await fonts());
  const [text] = await pdfPages(new Uint8Array(pdf.output("arraybuffer")));
  assert.match(text, /Shipping: \$1,234\.56/);
  assert.match(text, /Sales Tax: \$9,876\.54/);
  assert.match(text, /Total: \$11,113\.60/);
});
