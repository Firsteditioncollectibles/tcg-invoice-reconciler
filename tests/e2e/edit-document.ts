import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pdfPages } from "../pdf-content";

// All replacements are synthetic; also reused by ignored private-source checks.
export async function editEveryField(page: Page, info: TestInfo) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fields = {
    "Order date": "September 21, 2026",
    Channel: "Edited Marketplace",
    "Order number *": "VERIFIED-EDIT-002",
    Recipient: "Updated Recipient",
    "Delivery address": "88 Test Street\nTest City EX45",
    "Billing recipient": "Updated Buyer",
    "Billing address": "77 Sample Lane\nExample Town EX46",
    "Seller / store": "Updated Seller",
    "Tracking number": "UPDATED-TRACKING-002",
    "Shipping method": "Express delivery service",
    "Shipment / package reference": "PACKAGE-EDIT-002",
    "Reconciliation notes": "Received and checked.",
    Shipping: "2.25",
    Tax: "4.50",
    "Tax label": "Sales Tax (edited)",
    Discount: "1.20",
    "Description line 1": "Edited Pikachu 025/165",
    "Set line 1": "Edited Set",
    "Rarity line 1": "Illustration Rare",
    "Condition and details line 1": "Lightly Played Holofoil",
    "Unit price line 1": "2.34",
    "Quantity line 1": "3",
  };
  for (const [label, value] of Object.entries(fields))
    await page.getByLabel(label, { exact: true }).fill(value);
  await expect(page.getByLabel("Seller line 1", { exact: true })).toHaveValue(
    "Updated Seller",
  );
  // Check row-specific sellers stay independent of the order-level seller.
  await page
    .getByRole("row", { name: "Line 1", exact: true })
    .getByText("Seller & extracted text", { exact: true })
    .click();
  await page
    .getByLabel("Seller line 1", { exact: true })
    .fill("Special Row Seller");
  await expect(page.getByTestId("grand-total")).toHaveText("$78.60");
  const removed = await page
    .getByLabel("Description line 13", { exact: true })
    .inputValue();
  await page.getByLabel("Delete line 13", { exact: true }).click();
  await expect(page.getByTestId("grand-total")).toHaveText("$76.85");
  await page.getByRole("button", { name: "Add line" }).click();
  await page
    .getByLabel("Description line 13", { exact: true })
    .fill("Added card 010/165");
  await page.getByLabel("Unit price line 13", { exact: true }).fill("0.25");
  await page.getByLabel("Quantity line 13", { exact: true }).fill("2");
  await expect(page.getByTestId("grand-total")).toHaveText("$77.35");
  const exportButton = page.getByRole("button", {
    name: "Download reconciled PDF",
  });
  await expect(exportButton).toBeDisabled();
  await page.getByRole("button", { name: "I checked every line" }).click();
  await page.getByLabel("I checked the order details").check();
  await page.getByRole("button", { name: "Preview document" }).click();
  const preview = page.getByLabel("Reconciled document preview");
  await expect(preview.getByRole("status")).toHaveText(/^Page 1 of \d+$/);
  await expect(page.getByLabel("PDF page 1", { exact: true })).toBeVisible();
  const pageCount = Number(
    (await preview.getByRole("status").innerText()).split(" of ")[1],
  );
  if (pageCount > 1) {
    await preview.getByRole("button", { name: "Next page" }).click();
    await expect(preview.getByRole("status")).toHaveText(
      `Page 2 of ${pageCount}`,
    );
    await expect(page.getByLabel("PDF page 2", { exact: true })).toBeVisible();
    await preview.getByRole("button", { name: "Previous page" }).click();
    await expect(preview.getByRole("status")).toHaveText(
      `Page 1 of ${pageCount}`,
    );
  }
  await preview.screenshot({ path: info.outputPath("exact-pdf-preview.png") });
  // A later edit must invalidate both confirmation and the cached PDF.
  await page
    .getByLabel("Billing recipient", { exact: true })
    .fill("Final Buyer");
  await expect(preview).toHaveCount(0);
  await expect(exportButton).toBeDisabled();
  await page.getByLabel("I checked the order details").check();
  const pdfWait = page.waitForEvent("download");
  await exportButton.click();
  const pdf = await pdfWait;
  expect(pdf.suggestedFilename()).toBe(
    "reconciled-tcgplayer-VERIFIED-EDIT-002.pdf",
  );
  const pdfPath = info.outputPath("all-fields-edited.pdf");
  await pdf.saveAs(pdfPath);
  const pages = await pdfPages(await readFile(pdfPath));
  const text = pages.join(" ");
  const notesPage = pages.find((p) => p.includes("RECONCILIATION NOTES"));
  expect(notesPage).toContain("Received and checked.");
  expect(text).toMatch(/\$2\.34 3/);
  expect(text).toMatch(/\$0\.25 2/);
  for (const label of [
    "Order date",
    "Channel",
    "Order number *",
    "Recipient",
    "Delivery address",
    "Billing address",
    "Seller / store",
    "Tracking number",
    "Shipping method",
    "Tax label",
    "Shipment / package reference",
    "Reconciliation notes",
    "Description line 1",
    "Set line 1",
    "Rarity line 1",
    "Condition and details line 1",
  ])
    expect(text).toContain(
      fields[label as keyof typeof fields].replace(/\s+/g, " "),
    );
  for (const value of [
    "Final Buyer",
    "Special Row Seller",
    "Added card 010/165",
    "$77.35",
    "$2.34",
    "$2.25",
    "$4.50",
    "$1.20",
  ])
    expect(text).toContain(value);
  for (const value of [
    removed,
    "Updated Buyer",
    "RECONCILED SHIPMENT DOCUMENT",
    "Buyer-prepared",
    "Not a seller-issued",
  ])
    expect(text).not.toContain(value);
  const draftWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const draftPath = info.outputPath("edited-draft.json");
  await (await draftWait).saveAs(draftPath);
  await page.reload();
  await page.getByLabel("Open saved draft").setInputFiles(draftPath);
  for (const [label, value] of Object.entries(fields))
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      label === "Billing recipient" ? "Final Buyer" : value,
    );
  await expect(page.getByTestId("grand-total")).toHaveText("$77.35");
  await expect(exportButton).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
}
