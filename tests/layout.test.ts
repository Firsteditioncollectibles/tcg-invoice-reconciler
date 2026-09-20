import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOrder } from "../lib/parser";
import { totals, consolidate, emptyInvoice, readDraft } from "../lib/invoice";
import type { TextPage } from "../lib/layout";
const page = () =>
  JSON.parse(
    readFileSync("tests/fixtures/marketplace-layout.json", "utf8"),
  ) as TextPage;
test("marketplace columns keep summary, addresses and 13 multi-line products separate", () => {
  const doc = parseOrder("Synthetic marketplace source", "fixture.pdf", [
    page(),
  ]);
  assert.equal(doc.orderNumber, "SYNTHETIC-001-TEST");
  assert.equal(doc.orderDate, "September 20, 2026");
  assert.equal(doc.channel, "TCG Marketplace");
  assert.equal(doc.recipient, "Example Recipient");
  assert.equal(doc.billingRecipient, "Example Buyer");
  assert.equal(doc.seller, "Sample Card Store");
  assert.equal(doc.tracking, "TEST-TRACKING-001");
  assert.equal(doc.items.length, 13);
  assert.deepEqual(
    doc.items.map((i) => i.quantity),
    ["1", "1", "3", "4", "3", "1", "2", "1", "1", "1", "1", "1", "1"],
  );
  assert.equal(doc.items[0].description, "Pikachu 025/165");
  assert.equal(doc.items[0].setName, "Synthetic Test Set");
  assert.equal(doc.items[0].details, "Near Mint Holofoil");
  assert.equal(doc.items[0].rarity, "Ultra Rare");
  assert.equal(totals(doc).count, 21);
  assert.equal(totals(doc).subtotal, 6802);
  assert.equal(totals(doc).total, 7585);
  assert.equal(doc.sourceTotal, 7585);
  assert.equal(doc.warnings.length, 0);
});
test("an unreadable quantity stays empty and blocks export instead of inventing one", () => {
  const p = page();
  p.boxes = p.boxes.filter((b) => !(b.x > 1250 && b.y > 480 && b.y < 550));
  const doc = parseOrder("Synthetic source", "fixture.png", [p]);
  assert.equal(doc.items[0].quantity, "");
  assert.equal(totals(doc).valid, false);
  assert.ok(doc.warnings.some((w) => w.includes("quantity could not be read")));
});
test("an unreadable price preserves its own editable row without swallowing neighbouring cards", () => {
  const p = page();
  p.boxes = p.boxes.filter(
    (b) => !(b.x > 1030 && b.x < 1200 && b.y > 650 && b.y < 730),
  );
  const doc = parseOrder("Synthetic source", "fixture.png", [p]);
  assert.equal(doc.items.length, 13);
  assert.equal(doc.items[2].description, "Bulbasaur 001/165");
  assert.equal(doc.items[2].unitPrice, "");
  assert.equal(doc.items[1].setName, "Synthetic Test Set");
  assert.equal(doc.items[3].description, "Squirtle 007/165");
  assert.equal(totals(doc).valid, false);
  assert.ok(doc.warnings.some((w) => w.includes("price could not be read")));
});
test("different sets and rarities are not consolidated, and old drafts migrate", () => {
  const doc = parseOrder("Synthetic source", "fixture.pdf", [page()]);
  const a = doc.items[0];
  assert.equal(
    consolidate([a, { ...a, id: "other", setName: "Another set" }]).length,
    2,
  );
  assert.equal(
    consolidate([a, { ...a, id: "other", rarity: "Another rarity" }]).length,
    2,
  );
  const old: Record<string, unknown> = { ...emptyInvoice() };
  for (const key of [
    "channel",
    "billingRecipient",
    "billingAddress",
    "tracking",
    "shippingMethod",
    "sourceQuantity",
  ])
    delete old[key];
  assert.deepEqual(readDraft(JSON.stringify(old)), emptyInvoice());
});
