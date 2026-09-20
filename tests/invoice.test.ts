import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  editDocumentField,
  consolidate,
  emptyInvoice,
  readDraft,
  totals,
  type LineItem,
} from "../lib/invoice";
import { parseOrder } from "../lib/parser";
import { textInReadingOrder, validateFile } from "../lib/extract";
const line = (overrides: Partial<LineItem> = {}): LineItem => ({
  id: "1",
  description: "Mew ex 151/165",
  details: "Near Mint Holofoil",
  seller: "Example Cards",
  quantity: "1",
  unitPrice: "0.10",
  sourceText: "",
  reviewed: false,
  ...overrides,
});
export const RECEIPT = `TCGplayer
Order Number: ABC123-DEF456-789012
Order Date: September 19, 2026
Seller: Example Cards
Ship To:
Sample Buyer
123 Example Road
Example City, EX 12345
Quantity Description Price Total
2 Pikachu 025/165 Near Mint $1.25 $2.50
1 Charizard ex 199/165 Near Mint Holofoil $10.00 $10.00
1 Pikachu 025/165 Near Mint $1.25 $1.25
Subtotal: $13.75
Shipping: $1.99
Sales Tax: $0.80
Order Total: $16.54`;
test("decimal amounts never use float arithmetic", () => {
  assert.equal(cents("1.01"), 101);
  assert.equal(cents("0.29"), 29);
  for (const invalid of [
    "",
    "-1",
    "1e2",
    "Infinity",
    "0.001",
    "1,00",
    "  ",
    "1000000",
  ])
    assert.equal(cents(invalid), null);
  const doc = {
    ...emptyInvoice(),
    items: [line({ quantity: "3" }), line({ id: "2", unitPrice: "0.20" })],
  };
  assert.equal(totals(doc).subtotal, 50);
});
test("totals include shipping/tax, subtract discount, reject invalid quantity and negative total", () => {
  const doc = {
    ...emptyInvoice(),
    items: [line({ unitPrice: "12.34", quantity: "3" })],
    shipping: "1.99",
    tax: "2.00",
    discount: "0.01",
  };
  assert.equal(totals(doc).total, 4100);
  assert.equal(totals({ ...doc, discount: "50.00" }).valid, false);
  for (const q of ["0", "-1", "1.5", "10000", ""])
    assert.equal(
      totals({ ...doc, items: [line({ quantity: q })] }).valid,
      false,
    );
});
test("consolidation preserves cents, variants and seller boundaries without mutating input", () => {
  const items = [
    line(),
    line({ id: "2", quantity: "2" }),
    line({ id: "3", details: "Lightly Played" }),
    line({ id: "4", seller: "Other" }),
    line({ id: "5", unitPrice: "0.11" }),
  ];
  const merged = consolidate(items);
  assert.equal(merged.length, 4);
  assert.equal(merged[0].quantity, "3");
  assert.equal(items[0].quantity, "1");
  assert.equal(
    totals({ ...emptyInvoice(), items }).total,
    totals({ ...emptyInvoice(), items: merged }).total,
  );
});
test("editing the order seller updates matching rows and preserves a different row seller", () => {
  const doc = {
    ...emptyInvoice(),
    seller: "Example Cards",
    items: [
      line({ reviewed: true }),
      line({ id: "2", seller: "Another Seller", reviewed: true }),
    ],
  };
  const edited = editDocumentField(doc, "seller", "Corrected Store");
  assert.equal(edited.items[0].seller, "Corrected Store");
  assert.equal(edited.items[0].reviewed, false);
  assert.equal(edited.items[1].seller, "Another Seller");
  assert.equal(edited.items[1].reviewed, true);
  assert.equal(doc.items[0].seller, "Example Cards");
});
test("extracts TCGplayer metadata, conditions, card numbers, quantities and totals", () => {
  const doc = parseOrder(RECEIPT);
  assert.equal(doc.items.length, 3);
  assert.equal(doc.orderNumber, "ABC123-DEF456-789012");
  assert.equal(doc.recipient, "Sample Buyer");
  assert.equal(doc.items[0].quantity, "2");
  assert.equal(doc.items[0].description, "Pikachu 025/165");
  assert.equal(doc.items[1].details, "Near Mint Holofoil");
  assert.equal(doc.sourceTotal, 1654);
  assert.equal(totals(doc).total, 1654);
  assert.equal(doc.warnings.length, 0);
  assert.ok(doc.items.every((i) => !i.reviewed));
});
test("supports price / quantity / total columns and wrapped descriptions", () => {
  const doc = parseOrder(
    "Order #: ABC123\nDescription Price Quantity Total\nPokemon - Scarlet & Violet\nPikachu 025/165 Near Mint $1.25 2 $2.50\nSubtotal $2.50",
  );
  assert.equal(doc.items[0].quantity, "2");
  assert.match(doc.items[0].description, /Scarlet/);
  assert.equal(doc.sourceSubtotal, 250);
});
test("OCR word spacing preserves conditions, recipient and seller", () => {
  const doc = parseOrder(RECEIPT.replace(/ /g, "  "));
  assert.equal(doc.items[0].description, "Pikachu 025/165");
  assert.equal(doc.items[0].details, "Near Mint");
  assert.equal(doc.recipient, "Sample Buyer");
  assert.equal(doc.seller, "Example Cards");
});
test("a collector number is not silently treated as the quantity", () => {
  const doc = parseOrder(
    "Order #: ABC123\nDescription Price Total\nPikachu 123 $1.25 $1.25",
  );
  assert.equal(doc.items[0].description, "Pikachu 123");
  assert.equal(doc.items[0].quantity, "1");
});
test("flags mismatches and unreadable input instead of silently making up complete data", () => {
  assert.ok(
    parseOrder(RECEIPT.replace("$16.54", "$99.99")).warnings.some((w) =>
      w.includes("differs"),
    ),
  );
  assert.equal(parseOrder("an unreadable screenshot").items.length, 0);
  assert.ok(
    parseOrder(RECEIPT + "\nOrder #: OTHER123").warnings.some((w) =>
      w.includes("Multiple order"),
    ),
  );
});
test("stacked screenshot fields remain unreviewed and inferred quantities are disclosed", () => {
  const doc = parseOrder(
    "Order #: ABC123\nProduct Price\nPikachu 025/165\nNear Mint\nQuantity: 2\n$1.25",
  );
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].quantity, "2");
  assert.equal(doc.items[0].unitPrice, "1.25");
});
test("PDF text is reconstructed by visual baseline, not internal object order", () => {
  const item = (str: string, x: number, y: number) => ({
    str,
    transform: [1, 0, 0, 1, x, y],
    width: 30,
    height: 10,
  });
  assert.equal(
    textInReadingOrder([
      item("$1.25", 400, 100),
      item("Pikachu", 70, 100),
      item("Subtotal", 20, 80),
      item("2", 20, 100),
    ]),
    "2  Pikachu  $1.25\nSubtotal",
  );
});
test("rejects oversized/unsupported files and malformed drafts", () => {
  assert.throws(() =>
    validateFile({ name: "test.svg", size: 100, type: "image/svg+xml" }),
  );
  assert.throws(() =>
    validateFile({
      name: "test.pdf",
      size: 21 * 1024 * 1024,
      type: "application/pdf",
    }),
  );
  assert.throws(() => readDraft("{}"));
  assert.deepEqual(readDraft(JSON.stringify(emptyInvoice())), emptyInvoice());
  assert.throws(() =>
    readDraft(JSON.stringify({ ...emptyInvoice(), items: [line(), line()] })),
  );
});
