import { test } from "node:test";
import assert from "node:assert/strict";
import { createReconciledPdf, pdfFileName } from "../lib/pdf";
import { parseOrder } from "../lib/parser";
import { writeFile, mkdir, readFile } from "node:fs/promises";
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
  assert.equal(pdfFileName("../test"), "reconciled-tcgplayer----test.pdf");
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
  await mkdir("tmp/pdfs", { recursive: true });
  await writeFile(
    "tmp/pdfs/reconciled-100-lines.pdf",
    new Uint8Array(pdf.output("arraybuffer")),
  );
});
test("cannot export invalid, empty or unreviewed items", async () => {
  const d = sample();
  await assert.rejects(createReconciledPdf({ ...d, items: [] }));
  await assert.rejects(
    createReconciledPdf({ ...d, items: [{ ...d.items[0], reviewed: false }] }),
  );
  await assert.rejects(
    createReconciledPdf({ ...d, items: [{ ...d.items[0], quantity: "-1" }] }),
  );
  await assert.rejects(
    createReconciledPdf({ ...d, recipient: "漢字" }, await fonts()),
    /supports English/,
  );
});
