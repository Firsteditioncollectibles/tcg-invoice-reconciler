import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { editEveryField } from "./edit-document";
import { pdfPages } from "../pdf-content";
import { jsPDF } from "jspdf";

test("a PDF with selectable summary text still scans the image-only card table", async ({
  page,
}) => {
  const pdf = new jsPDF({ unit: "pt", format: [1428, 1690], compress: true });
  pdf.setFontSize(18);
  pdf.text(
    "TCGplayer purchase record with an attached scanned item table",
    30,
    25,
  );
  pdf.text("Order Total: $75.85", 30, 48);
  pdf.addImage(
    new Uint8Array(await readFile("tests/fixtures/marketplace-screenshot.png")),
    "PNG",
    0,
    64,
    1428,
    1626,
  );
  await page.goto("/");
  await page.getByLabel("Upload TCGplayer screenshot or PDF").setInputFiles({
    name: "hybrid-marketplace.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.getByRole("row", { name: /^Line \d+$/ })).toHaveCount(13, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("grand-total")).toHaveText("$75.85");
  await expect(page.getByTestId("card-count")).toHaveText("21");
});
test("editor, consolidation, deletion, accurate totals, draft round-trip, and PDF download", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your order. Reconciled." }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("home.png"), fullPage: true });
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByTestId("grand-total")).toHaveText("$16.54");
  const exportButton = page.getByRole("button", {
    name: "Download reconciled PDF",
  });
  await expect(exportButton).toBeEnabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByLabel("Order number *", { exact: true }).fill("");
  await expect(exportButton).toBeDisabled();
  await page
    .getByLabel("Order number *", { exact: true })
    .fill("SAMPLE-123456");
  await expect(exportButton).toBeEnabled();
  await page.getByRole("button", { name: "Consolidate duplicates" }).click();
  await expect(page.getByLabel("Quantity line 1", { exact: true })).toHaveValue(
    "3",
  );
  await expect(page.getByTestId("grand-total")).toHaveText("$16.54");
  await page.getByLabel("Delete line 2", { exact: true }).click();
  await expect(page.getByTestId("grand-total")).toHaveText("$6.54");
  await page.getByLabel("Quantity line 1", { exact: true }).fill("2");
  await page.getByLabel("Unit price line 1", { exact: true }).fill("0.10");
  await page.getByLabel("Discount", { exact: true }).fill("0.01");
  await expect(page.getByTestId("grand-total")).toHaveText("$2.98");
  await page.getByLabel("Quantity line 1", { exact: true }).fill("1.5");
  await expect(
    page.getByRole("alert").filter({ hasText: "whole number" }),
  ).toBeVisible();
  await expect(exportButton).toBeDisabled();
  await page.getByLabel("Quantity line 1", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Preview document" }).click();
  await expect(
    page.getByLabel("Reconciled document preview").getByRole("status"),
  ).toHaveText("Page 1 of 1");
  await expect(page.getByLabel("PDF page 1", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("reconciler-desktop.png"),
    fullPage: true,
  });
  const pdfWait = page.waitForEvent("download");
  await exportButton.click();
  const pdf = await pdfWait;
  expect(pdf.suggestedFilename()).toBe("Example Cards.pdf");
  await pdf.saveAs(info.outputPath("reconciled.pdf"));
  expect(
    (await readFile(info.outputPath("reconciled.pdf")))
      .subarray(0, 4)
      .toString(),
  ).toBe("%PDF");
  const exportedText = (
    await pdfPages(await readFile(info.outputPath("reconciled.pdf")))
  ).join(" ");
  expect(exportedText).toContain("$2.98");
  expect(exportedText).not.toContain("Charizard");
  const draftWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const draft = await draftWait;
  expect(draft.suggestedFilename()).toBe("Example Cards.json");
  await draft.saveAs(info.outputPath("draft.json"));
  await page.reload();
  await page
    .getByLabel("Open saved draft")
    .setInputFiles(info.outputPath("draft.json"));
  await expect(page.getByTestId("grand-total")).toHaveText("$2.98");
  await expect(exportButton).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("reconciler-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("every marketplace box can be edited, previewed, exported and reopened", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByLabel("Upload TCGplayer screenshot or PDF")
    .setInputFiles("tests/fixtures/marketplace-text.pdf");
  await expect(page.getByTestId("grand-total")).toHaveText("$75.85");
  await editEveryField(page, info);
});
for (const file of [
  "tcgplayer-text.pdf",
  "tcgplayer-screenshot.png",
  "tcgplayer-scanned.pdf",
]) {
  test(`real file extraction: ${file}`, async ({ page }, info) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (
        /^https?:/.test(r.url()) &&
        !r.url().startsWith("http://127.0.0.1:3148")
      )
        requests.push(r.url());
    });
    await page.goto("/");
    await page
      .getByLabel("Upload TCGplayer screenshot or PDF")
      .setInputFiles(`tests/fixtures/${file}`);
    await expect(
      page.getByLabel("Description line 1", { exact: true }),
    ).toBeVisible({ timeout: 100_000 });
    await expect(
      page.getByLabel("Quantity line 1", { exact: true }),
    ).toHaveValue("2");
    await expect(
      page.getByLabel("Unit price line 1", { exact: true }),
    ).toHaveValue("1.25");
    await expect(
      page.getByLabel("Description line 1", { exact: true }),
    ).toHaveValue("Pikachu 025/165");
    await expect(
      page.getByLabel("Condition and details line 1", { exact: true }),
    ).toHaveValue("Near Mint");
    await expect(page.getByLabel("Recipient", { exact: true })).toHaveValue(
      "Sample Buyer",
    );
    await expect(page.getByTestId("grand-total")).toHaveText("$16.54");
    const wait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download reconciled PDF" }).click();
    await (await wait).saveAs(info.outputPath("reconciled.pdf"));
    expect(requests).toEqual([]);
  });
}
test("bad file is actionable and does not destroy current edits", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  page.on("dialog", (d) => d.accept());
  await page.getByLabel("Upload TCGplayer screenshot or PDF").setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(page.locator(".message.error")).toBeVisible();
  await expect(page.getByTestId("grand-total")).toHaveText("$16.54");
  await expect(page.getByRole("button", { name: "Choose file" })).toBeEnabled();
});
test("failed PDF preparation preserves edits and lets the user retry", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await page
    .getByLabel("Billing recipient", { exact: true })
    .fill("Saved Buyer");
  await page.route("**/vendor/standard_fonts/*.ttf", (route) =>
    route.fulfill({ status: 404, body: "Missing test font" }),
  );
  await page.getByRole("button", { name: "Preview document" }).click();
  await expect(page.locator(".message.error")).toContainText(
    "Could not load the PDF font",
  );
  await expect(
    page.getByLabel("Billing recipient", { exact: true }),
  ).toHaveValue("Saved Buyer");
  await expect(page.getByTestId("grand-total")).toHaveText("$16.54");
  const exportButton = page.getByRole("button", {
    name: "Download reconciled PDF",
  });
  await expect(exportButton).toBeEnabled();
  await page.unroute("**/vendor/standard_fonts/*.ttf");
  const wait = page.waitForEvent("download");
  await exportButton.click();
  await (await wait).saveAs(info.outputPath("retry-success.pdf"));
  await expect(page.locator(".message.error")).toHaveCount(0);
});
test("cancelling an import during OCR initialization restores a usable editor", async ({
  page,
}) => {
  await page.route("**/vendor/ocr/**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue().catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  page.on("dialog", (d) => d.accept());
  await page
    .getByLabel("Upload TCGplayer screenshot or PDF")
    .setInputFiles("tests/fixtures/tcgplayer-screenshot.png");
  await page.getByRole("button", { name: "Cancel import" }).click();
  await expect(
    page.getByText("Import cancelled. Your previous order is unchanged."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose file" })).toBeEnabled();
  await expect(page.getByTestId("grand-total")).toHaveText("$16.54");
});
test("missing OCR assets fail clearly rather than leaving an endless scanner", async ({
  page,
}) => {
  await page.route("**/vendor/ocr/worker.min.js", (route) =>
    route.fulfill({ status: 404, body: "Missing test asset" }),
  );
  await page.goto("/");
  await page
    .getByLabel("Upload TCGplayer screenshot or PDF")
    .setInputFiles("tests/fixtures/tcgplayer-screenshot.png");
  await expect(page.locator(".message.error")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose file" })).toBeEnabled();
});

for (const file of [
  "marketplace-text.pdf",
  "marketplace-screenshot.png",
  "marketplace-scanned.pdf",
]) {
  test(`marketplace grid: ${file}`, async ({ page }, info) => {
    await page.goto("/");
    await page
      .getByLabel("Upload TCGplayer screenshot or PDF")
      .setInputFiles(`tests/fixtures/${file}`);
    await expect(
      page.getByLabel("Description line 13", { exact: true }),
    ).toBeVisible({ timeout: 100_000 });
    await expect(page.getByTestId("grand-total")).toHaveText("$75.85");
    await expect(page.getByTestId("card-count")).toHaveText("21");
    await expect(page.locator(".source-drawing image")).toHaveCount(13);
    const backs = await page
      .locator(".source-drawing image")
      .evaluateAll((images) => images.map((im) => im.getAttribute("href")));
    expect(new Set(backs).size).toBe(1);
    expect(backs[0]).toMatch(/^data:image\/jpeg;base64,/);
    await expect(
      page.getByLabel("Order number *", { exact: true }),
    ).toHaveValue("SYNTHETIC-001-TEST");
    await expect(
      page.getByLabel("Billing recipient", { exact: true }),
    ).toHaveValue("Example Buyer");
    await expect(page.getByLabel("Set line 1", { exact: true })).toHaveValue(
      "Synthetic Test Set",
    );
    await expect(page.getByLabel("Rarity line 1", { exact: true })).toHaveValue(
      "Ultra Rare",
    );
    await expect(
      page.getByLabel("Quantity line 4", { exact: true }),
    ).toHaveValue("4");
    await expect(
      page.getByLabel("Unit price line 12", { exact: true }),
    ).toHaveValue("13.49");
    await page.getByLabel("Quantity line 4", { exact: true }).fill("2");
    await page
      .getByLabel("Billing recipient", { exact: true })
      .fill("Updated Example Buyer");
    await page
      .getByLabel("Set line 1", { exact: true })
      .fill("Corrected Test Set");
    await expect(page.getByTestId("grand-total")).toHaveText("$73.87");
    await page.getByLabel("Delete line 13", { exact: true }).click();
    await expect(page.getByTestId("grand-total")).toHaveText("$72.12");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByTestId("grand-total")).toHaveText("$73.87");
    const wait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download reconciled PDF" }).click();
    const downloaded = await wait;
    expect(downloaded.suggestedFilename()).toBe("Sample Card Store.pdf");
    await downloaded.saveAs(info.outputPath("marketplace-reconciled.pdf"));
    await page.screenshot({
      path: info.outputPath("document-boxes.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
