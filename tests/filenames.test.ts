import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfFileName, draftFileName } from "../lib/filenames";

test("downloads use the order seller and safe fallbacks", () => {
  assert.equal(
    pdfFileName("ORDER-123", "Sample Card House"),
    "Sample Card House.pdf",
  );
  assert.equal(
    draftFileName("ORDER-123", "Sample Card House"),
    "Sample Card House.json",
  );
  assert.equal(
    pdfFileName("ORDER-123", "  BeeHive Collective  "),
    "BeeHive Collective.pdf",
  );
  assert.equal(pdfFileName("ORDER-123", "Pokémon & Co."), "Pokémon & Co.pdf");
  assert.equal(pdfFileName("ORDER-123", "../Card:House/"), "Card-House.pdf");
  assert.equal(pdfFileName("ORDER-123", "..."), "ORDER-123.pdf");
  assert.equal(pdfFileName("", ""), "TCGplayer order.pdf");
  assert.ok(pdfFileName("ORDER-123", "A".repeat(500)).length < 130);
});
